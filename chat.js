// The visitor's chat page.
import { SITE_NAME } from "./config.js";
import { createBackend } from "./backend.js";
import { pickAutoReply } from "./autoreplies.js";

const $ = (id) => document.getElementById(id);
const messagesEl = $("messages");
const form = $("form");
const input = $("input");

document.title = SITE_NAME;
$("siteName").textContent = SITE_NAME;

const ID_KEY = "probably-ai-chat-id";
function newChatId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
let chatId = localStorage.getItem(ID_KEY);
if (!chatId) {
  chatId = newChatId();
  localStorage.setItem(ID_KEY, chatId);
}

let backend;
let settings = { autoReply: true, delaySeconds: 8 };
let messages = [];
let timer = null;
let timerFor = null; // id of the visitor message the timer belongs to
let unsubMessages = null;
let lastSend = 0;

function bubble(kind, text) {
  const div = document.createElement("div");
  div.className = "bubble " + kind;
  div.textContent = text; // textContent (not innerHTML) so visitors can't inject code
  return div;
}

function typingBubble() {
  const div = document.createElement("div");
  div.className = "bubble bot typing";
  for (let i = 0; i < 3; i++) div.appendChild(document.createElement("span"));
  return div;
}

function disarm() {
  clearTimeout(timer);
  timer = null;
  timerFor = null;
}

// If the last message is the visitor's and nobody answered within the delay,
// post a scripted reply. A real reply from the admin cancels this automatically,
// because then the last message is no longer the visitor's.
function arm(last) {
  if (timerFor === last.id) return;
  disarm();
  timerFor = last.id;
  if (!settings.autoReply) return;
  const wait = Math.max(0, settings.delaySeconds * 1000 - (Date.now() - last.ts));
  timer = setTimeout(async () => {
    timer = null;
    const current = messages[messages.length - 1];
    if (!current || current.id !== last.id || !settings.autoReply) return;
    try {
      await backend.sendMessage(chatId, "auto", pickAutoReply(last.text));
    } catch (err) {
      console.error(err);
    }
  }, wait);
}

function render() {
  messagesEl.replaceChildren();
  messagesEl.appendChild(bubble("bot", `Hi! I'm ${SITE_NAME}. Ask me anything.`));
  for (const m of messages) messagesEl.appendChild(bubble(m.from === "user" ? "me" : "bot", m.text));
  const last = messages[messages.length - 1];
  if (last && last.from === "user") {
    messagesEl.appendChild(typingBubble());
    arm(last);
  } else {
    disarm();
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function subscribe() {
  if (unsubMessages) unsubMessages();
  disarm();
  messages = [];
  unsubMessages = backend.onMessages(chatId, (list) => {
    messages = list;
    render();
  });
}

async function send() {
  const text = input.value.trim().slice(0, 1000);
  if (!text || Date.now() - lastSend < 800) return;
  lastSend = Date.now();
  input.value = "";
  input.style.height = "auto";
  try {
    await backend.sendMessage(chatId, "user", text);
  } catch (err) {
    console.error(err);
    messagesEl.appendChild(bubble("bot error", "Connection problem. Please try again."));
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});
$("newChat").addEventListener("click", () => {
  chatId = newChatId();
  localStorage.setItem(ID_KEY, chatId);
  subscribe();
});

(async function init() {
  try {
    backend = await createBackend();
    if (backend.mode === "demo") $("demoBanner").hidden = false;
    backend.onSettings((s) => {
      settings = s;
      timerFor = null; // re-evaluate the timer with the new settings
      render();
    });
    subscribe();
  } catch (err) {
    console.error(err);
    messagesEl.appendChild(bubble("bot error", "Could not connect. Please refresh the page."));
  }
})();
