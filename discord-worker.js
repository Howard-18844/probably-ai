// Cloudflare Worker: connects your website to Discord, in both directions.
//
//   Website  --(POST /notify)-->  this Worker  -->  Discord channel (message with a Reply button)
//   You click Reply in Discord -> Discord --(POST /discord)--> this Worker -->  your reply is
//   written into the website's database, so the visitor sees it right away.
//
// See DISCORD-SETUP.md for the setup steps. Secrets/variables it needs (set in Cloudflare):
//   DISCORD_BOT_TOKEN   (secret)  the bot's token
//   DISCORD_PUBLIC_KEY  (secret)  the application's public key
//   DISCORD_CHANNEL_ID            channel where visitor messages are posted
//   OWNER_DISCORD_ID              your Discord user id (only you may reply). Several: separate with commas
//   FIREBASE_API_KEY              same apiKey as in config.js
//   FIREBASE_PROJECT_ID           same projectId as in config.js
//   BOT_EMAIL                     email of the Firebase "bot" user
//   BOT_PASSWORD        (secret)  password of the Firebase "bot" user

// Only web pages on these addresses may call /notify.
const ALLOWED_ORIGINS = ["https://howard-18844.github.io", "http://localhost:8000"];

const DISCORD_API = "https://discord.com/api/v10";
const CHAT_ID = /^[0-9a-f]{32}$/; // chat ids are 32 random hex characters

const encoder = new TextEncoder();
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...extra } });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/discord" && request.method === "POST") return handleDiscord(request, env, ctx);
    if (pathname === "/notify") return handleNotify(request, env);
    return new Response("Probably AI Discord bridge is running.");
  },
};

// ---------------------------------------------------------------
//  1) Website -> Discord
// ---------------------------------------------------------------
const lastNotify = new Map(); // chat id -> time of its last message (best-effort throttle)
let windowStart = 0;
let windowCount = 0;

function tooFast(chatId) {
  const now = Date.now();
  if (now - (lastNotify.get(chatId) || 0) < 1500) return true;
  if (now - windowStart > 60000) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > 40) return true;
  lastNotify.set(chatId, now);
  if (lastNotify.size > 500) lastNotify.clear();
  return false;
}

async function handleNotify(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
  if (!allowed) return json({ error: "not allowed" }, 403, cors);
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) return json({ error: "not configured" }, 500, cors);

  let chatId = "";
  let text = "";
  try {
    const body = await request.json();
    chatId = String(body.chatId || "");
    text = String(body.text || "").trim().slice(0, 1000);
  } catch {
    return json({ error: "bad request" }, 400, cors);
  }
  if (!CHAT_ID.test(chatId) || !text) return json({ error: "bad request" }, 400, cors);
  if (tooFast(chatId)) return json({ error: "slow down" }, 429, cors);

  const quoted = text.replace(/\n/g, "\n> ");
  const res = await fetch(`${DISCORD_API}/channels/${encodeURIComponent(env.DISCORD_CHANNEL_ID)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "DiscordBot (https://github.com/Howard-18844/probably-ai, 1.0)",
    },
    body: JSON.stringify({
      content: `💬 **Visitor ${chatId.slice(0, 4)}**\n> ${quoted}`.slice(0, 1990),
      allowed_mentions: { parse: [] }, // visitors can't make the bot ping @everyone
      components: [
        { type: 1, components: [{ type: 2, style: 1, label: "Reply", custom_id: `reply:${chatId}` }] },
      ],
    }),
  });
  if (!res.ok) return json({ error: "discord failed" }, 502, cors);
  return json({ ok: true }, 200, cors);
}

// ---------------------------------------------------------------
//  2) Discord -> website
// ---------------------------------------------------------------
function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));
}

// Discord signs every request. Anything without a valid signature is rejected.
async function verifyDiscordSignature(request, rawBody, publicKeyHex) {
  const signature = request.headers.get("X-Signature-Ed25519") || "";
  const timestamp = request.headers.get("X-Signature-Timestamp") || "";
  if (!/^[0-9a-f]{128}$/i.test(signature) || !/^[0-9a-f]{64}$/i.test(publicKeyHex || "")) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false; // old = possible replay
  const data = encoder.encode(timestamp + rawBody);
  // Cloudflare supports Ed25519 under two names depending on the runtime version.
  for (const algorithm of [{ name: "Ed25519" }, { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }]) {
    try {
      const key = await crypto.subtle.importKey("raw", hexToBytes(publicKeyHex), algorithm, false, ["verify"]);
      return await crypto.subtle.verify(algorithm, key, hexToBytes(signature), data);
    } catch {
      // this name is not supported here, try the other one
    }
  }
  return false;
}

const ephemeral = (content) => json({ type: 4, data: { content, flags: 64 } }); // only you see it

function flattenInputs(components = []) {
  return components.flatMap((row) => row.components || [row]);
}

async function handleDiscord(request, env, ctx) {
  const raw = await request.text();
  if (!(await verifyDiscordSignature(request, raw, env.DISCORD_PUBLIC_KEY))) {
    return new Response("invalid request signature", { status: 401 });
  }
  let interaction;
  try {
    interaction = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (interaction.type === 1) return json({ type: 1 }); // Discord's "are you alive?" check

  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? "";
  const owners = String(env.OWNER_DISCORD_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  const isOwner = !!userId && owners.includes(userId);
  const customId = String(interaction.data?.custom_id || "");

  // You pressed the "Reply" button -> open a box to type the reply.
  if (interaction.type === 3 && customId.startsWith("reply:")) {
    if (!isOwner) return ephemeral("Only the site owner can reply.");
    const chatId = customId.slice("reply:".length);
    if (!CHAT_ID.test(chatId)) return ephemeral("That chat id looks wrong.");
    return json({
      type: 9,
      data: {
        custom_id: `modal:${chatId}`,
        title: `Reply to Visitor ${chatId.slice(0, 4)}`,
        components: [
          {
            type: 1,
            components: [
              { type: 4, custom_id: "text", label: "Your reply (the visitor sees this)", style: 2, min_length: 1, max_length: 1000, required: true },
            ],
          },
        ],
      },
    });
  }

  // You submitted the box -> save the reply for the visitor.
  if (interaction.type === 5 && customId.startsWith("modal:")) {
    if (!isOwner) return ephemeral("Only the site owner can reply.");
    const chatId = customId.slice("modal:".length);
    const text = String(flattenInputs(interaction.data?.components)[0]?.value || "").trim().slice(0, 1000);
    if (!CHAT_ID.test(chatId) || !text) return ephemeral("Empty reply, nothing was sent.");
    // Discord wants an answer within 3 seconds, so say "working on it" now and finish afterwards.
    ctx.waitUntil(sendReplyAndConfirm(env, interaction, chatId, text));
    return json({ type: 5 });
  }

  return ephemeral("Unknown action.");
}

async function sendReplyAndConfirm(env, interaction, chatId, text) {
  let content;
  try {
    await writeHumanReply(env, chatId, text);
    content = `↪ **You** → Visitor ${chatId.slice(0, 4)}: ${text}`.slice(0, 1990);
  } catch (err) {
    content = `❌ Could not send the reply: ${String(err && err.message ? err.message : err).slice(0, 300)}`;
  }
  try {
    await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
  } catch (err) {
    console.error("Could not update the Discord message:", err);
  }
}

// ---------------------------------------------------------------
//  3) Writing to the website's database (Firestore REST API)
//     The Worker signs in as a special "bot" user. The database rules
//     (firestore.rules) let that one user write replies, nothing else.
// ---------------------------------------------------------------
const tokenCache = new Map(); // bot email -> { token, expires }

async function getIdToken(env) {
  const cached = tokenCache.get(env.BOT_EMAIL);
  if (cached && cached.expires > Date.now()) return cached.token;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.BOT_EMAIL, password: env.BOT_PASSWORD, returnSecureToken: true }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) {
    throw new Error("Firebase sign-in failed: " + (data.error?.message || res.status));
  }
  tokenCache.set(env.BOT_EMAIL, {
    token: data.idToken,
    expires: Date.now() + (Number(data.expiresIn) || 3600) * 1000 - 120000,
  });
  return data.idToken;
}

async function firestoreError(res, env) {
  if (res.status === 401) tokenCache.delete(env.BOT_EMAIL); // token went bad, sign in again next time
  const data = await res.json().catch(() => ({}));
  return new Error(`Firestore ${res.status}: ${data.error?.message || "request failed"}`.slice(0, 300));
}

async function writeHumanReply(env, chatId, text) {
  const token = await getIdToken(env);
  const base =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}` +
    `/databases/(default)/documents/chats/${chatId}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const now = String(Date.now());

  // 1. the message itself (same shape the website writes)
  let res = await fetch(`${base}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: { from: { stringValue: "human" }, text: { stringValue: text }, ts: { integerValue: now } } }),
  });
  if (!res.ok) throw await firestoreError(res, env);

  // 2. the chat summary shown in your admin list ("you answered, nothing is waiting")
  const mask = ["lastAt", "lastText", "lastFrom", "needsReply"].map((f) => `updateMask.fieldPaths=${f}`).join("&");
  res = await fetch(`${base}?${mask}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: {
        lastAt: { integerValue: now },
        lastText: { stringValue: text.slice(0, 80) },
        lastFrom: { stringValue: "human" },
        needsReply: { booleanValue: false },
      },
    }),
  });
  if (!res.ok) throw await firestoreError(res, env);
}
