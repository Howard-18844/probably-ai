// The AI that ALWAYS tells bad dad jokes.
// Three sources are tried in this order, so you always get a joke:
//   1. Your own free AI (a Cloudflare Worker) - only if AI_ENDPOINT is set in config.js
//   2. The free website icanhazdadjoke.com (no account or key needed)
//   3. The lists below (work even if the internet services are down)
import { AI_ENDPOINT } from "./config.js";

const ENGLISH = [
  "I only know 25 letters of the alphabet. I don't know y.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I used to hate facial hair, but then it grew on me.",
  "What do you call a fake noodle? An impasta.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "I would tell you a construction joke, but I'm still working on it.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Did you hear about the claustrophobic astronaut? He just needed a little space.",
  "I'm afraid for the calendar. Its days are numbered.",
  "Why can't you trust stairs? They're always up to something.",
  "What did the ocean say to the beach? Nothing, it just waved.",
];

const CHINESE = [
  "為什麼數學課本很傷心?因為它有太多問題。",
  "為什麼小明帶著梯子去上學?因為他要上高中。",
  "什麼東西越洗越髒?水。",
  "為什麼電腦很怕冷?因為它開了太多視窗。",
  "我昨天買了一台時光機,不過要等到明天才會送到。",
];

let lastIndex = -1;

// Picks a joke from the built-in lists, never the same one twice in a row.
export function pickLocalJoke(userText = "") {
  const list = /[㐀-鿿]/.test(userText) ? CHINESE : ENGLISH;
  let i;
  do {
    i = Math.floor(Math.random() * list.length);
  } while (i === lastIndex && list.length > 1);
  lastIndex = i;
  return list[i];
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function clean(text) {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 400) : null;
}

async function fromAI(userText) {
  if (!AI_ENDPOINT) return null;
  const res = await fetchWithTimeout(
    AI_ENDPOINT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText.slice(0, 300) }),
    },
    7000
  );
  if (!res.ok) return null;
  const data = await res.json();
  return clean(data.reply);
}

async function fromDadJokeSite() {
  const res = await fetchWithTimeout("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" } }, 4000);
  if (!res.ok) return null;
  const data = await res.json();
  return clean(data.joke);
}

// Returns a bad dad joke. Never throws: the last fallback is the local list.
export async function getAutoReply(userText) {
  const hasChinese = /[㐀-鿿]/.test(userText);
  const sources = [fromAI];
  if (!hasChinese) sources.push(fromDadJokeSite); // that website only has English jokes
  for (const source of sources) {
    try {
      const joke = await source(userText);
      if (joke) return joke;
    } catch (err) {
      console.warn("Joke source failed, trying the next one:", err);
    }
  }
  return pickLocalJoke(userText);
}
