// Your private control panel: see visitor messages and reply as the "AI".
import { SITE_NAME, ADMIN_EMAIL } from "./config.js";
import { createBackend } from "./backend.js";

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // never innerHTML: visitor text is untrusted
  return node;
}

let backend;
let started = false;
let chats = [];
let selected = null;
let unsubConvo = null;

function timeLabel(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
}

// Buttons are reused (not rebuilt) on every update, so a click that happens
// at the same moment a new message arrives is never lost.
const chatButtons = new Map();

function chatButton(id) {
  let item = chatButtons.get(id);
  if (!item) {
    item = el("button", "chat-item");
    item.type = "button";
    item.appendChild(el("div", "chat-item-top"));
    item.firstChild.appendChild(el("strong", "", "Visitor " + id.slice(0, 4)));
    item.firstChild.appendChild(el("span", "muted"));
    item.appendChild(el("div", "chat-item-preview"));
    item.addEventListener("click", () => selectChat(id));
    chatButtons.set(id, item);
  }
  return item;
}

function renderChats() {
  const list = $("chatList");
  const empty = list.querySelector(".empty");
  if (empty) empty.remove();
  if (!chats.length) list.appendChild(el("p", "empty", "No chats yet. Share your site link!"));
  chats.forEach((c, i) => {
    const item = chatButton(c.id);
    item.className = "chat-item" + (c.id === selected ? " active" : "") + (c.needsReply ? " waiting" : "");
    item.firstChild.lastChild.textContent = timeLabel(c.lastAt);
    item.lastChild.textContent = (c.needsReply ? "● " : "") + c.lastText;
    if (list.children[i] !== item) list.insertBefore(item, list.children[i] || null);
  });
  const waiting = chats.filter((c) => c.needsReply).length;
  document.title = (waiting ? `(${waiting}) ` : "") + SITE_NAME + " admin";
}

function renderConvo(msgs) {
  const box = $("convoMessages");
  box.replaceChildren();
  const labels = { user: "Visitor", human: "You", auto: "Auto-bot" };
  const kinds = { user: "visitor", human: "you", auto: "auto" };
  for (const m of msgs) {
    const wrap = el("div", "bubble " + kinds[m.from]);
    wrap.appendChild(el("div", "who", labels[m.from] + " · " + timeLabel(m.ts)));
    wrap.appendChild(el("div", "", m.text));
    box.appendChild(wrap);
  }
  box.scrollTop = box.scrollHeight;
}

function selectChat(id) {
  selected = id;
  if (unsubConvo) unsubConvo();
  unsubConvo = backend.onMessages(id, renderConvo);
  $("convoEmpty").hidden = true;
  $("convoMessages").hidden = false;
  $("replyForm").hidden = false;
  $("replyInput").focus();
  renderChats();
}

async function sendReply() {
  const input = $("replyInput");
  const text = input.value.trim().slice(0, 1000);
  if (!text || !selected) return;
  input.value = "";
  try {
    await backend.sendMessage(selected, "human", text);
  } catch (err) {
    console.error(err);
    input.value = text;
    $("replyError").textContent = "Could not send: " + err.message;
  }
}

function clampDelay(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(120, Math.max(2, n)) : 8;
}

function start() {
  if (backend.mode === "demo") $("demoBanner").hidden = false;
  backend.onChats((list) => {
    chats = list;
    renderChats();
  });
  backend.onSettings((s) => {
    $("autoReply").checked = !!s.autoReply;
    if (document.activeElement !== $("delay")) $("delay").value = s.delaySeconds;
  });
  const save = () => backend.saveSettings({ autoReply: $("autoReply").checked, delaySeconds: clampDelay($("delay").value) });
  $("autoReply").addEventListener("change", save);
  $("delay").addEventListener("change", save);
  $("replyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    sendReply();
  });
  $("replyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  });
}

(async function init() {
  try {
    backend = await createBackend();
  } catch (err) {
    console.error(err);
    $("login").hidden = false;
    $("loginError").textContent = "Could not connect: " + err.message;
    return;
  }
  $("signIn").addEventListener("click", () =>
    backend.auth.signIn().catch((err) => ($("loginError").textContent = err.message))
  );
  $("signOut").addEventListener("click", () => backend.auth.signOut());
  $("signOutDenied").addEventListener("click", () => backend.auth.signOut());

  backend.auth.onChange((user) => {
    const allowed = !!user && (!ADMIN_EMAIL || user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    $("login").hidden = !!user;
    $("denied").hidden = !(user && !allowed);
    $("app").hidden = !allowed;
    if (allowed && !started) {
      started = true;
      start();
    }
  });
})();
