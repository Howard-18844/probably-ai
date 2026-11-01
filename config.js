// ------------------------------------------------------------
//  SETTINGS YOU CAN EDIT
// ------------------------------------------------------------

// The name shown at the top of the chat page.
export const SITE_NAME = "Probably AI";

// Your Google email. Only this account can use admin.html.
// (Also put it in firestore.rules - see README.md)
export const ADMIN_EMAIL = "davidho0099@gmail.com";

// OPTIONAL: the address of your free dad-joke AI (see AI-SETUP.md).
// Example: "https://probably-ai-jokes.yourname.workers.dev"
// Leave it as "" to skip it. The site still tells dad jokes (from a free joke
// website, then from a built-in list).
export const AI_ENDPOINT = "https://probably-ai-jokes.ggwpyee87.workers.dev";

// OPTIONAL: talk to visitors from Discord (see DISCORD-SETUP.md).
// Example: "https://probably-ai-discord.yourname.workers.dev/notify"
// Leave it as "" to switch Discord off.
export const DISCORD_NOTIFY_URL = "https://probably-ai-discord.ggwpyee87.workers.dev/notify";

// Your Firebase web-app config (safe to be public; the rules protect your data).
export const firebaseConfig = {
  apiKey: "AIzaSyAUZlxohUYnwJ8KSkvJ19zDGjYjLDEowog",
  authDomain: "probably-ai-11e3b.firebaseapp.com",
  projectId: "probably-ai-11e3b",
  storageBucket: "probably-ai-11e3b.firebasestorage.app",
  messagingSenderId: "810817891643",
  appId: "1:810817891643:web:b5b5285d9cf2d803ae9b1e"
};