// Tells the Discord Worker that a visitor wrote something, so it shows up in your Discord channel.
// If DISCORD_NOTIFY_URL is empty in config.js, this does nothing.
import { DISCORD_NOTIFY_URL } from "./config.js";

export function notifyDiscord(chatId, text) {
  if (!DISCORD_NOTIFY_URL) return;
  fetch(DISCORD_NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, text }),
    keepalive: true, // still sent if the visitor closes the tab right away
  }).catch(() => {
    // Discord being down must never break the chat
  });
}
