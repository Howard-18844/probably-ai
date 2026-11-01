// Talks to the "database". Two versions with the same shape:
//  - Firebase (real, free Spark plan) when config.js has your Firebase config
//  - Demo (browser only) when it does not
import { firebaseConfig } from "./config.js";

export const DEFAULT_SETTINGS = { autoReply: true, delaySeconds: 8 };

export async function createBackend() {
  if (firebaseConfig && firebaseConfig.apiKey) return createFirebaseBackend();
  return createDemoBackend();
}

// Summary info stored on the chat so the admin list is cheap to show.
function chatMeta(from, text, now) {
  const meta = { lastAt: now, lastText: text.slice(0, 80), lastFrom: from };
  if (from === "user") meta.needsReply = true; // visitor wrote, nobody human answered yet
  if (from === "human") meta.needsReply = false; // you answered
  return meta; // "auto" leaves needsReply as it was
}

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------
//  DEMO backend: data lives in localStorage of this browser.
//  Open index.html and admin.html in the same browser to try it.
// ---------------------------------------------------------------
function createDemoBackend() {
  const KEY = "probably-ai-demo-db";
  const channel = new BroadcastChannel(KEY);
  const listeners = new Set();
  const fresh = () => ({ chats: {}, messages: {}, settings: { ...DEFAULT_SETTINGS } });
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { return fresh(); }
  };
  const notify = () => listeners.forEach((fn) => fn());
  const write = (db) => {
    localStorage.setItem(KEY, JSON.stringify(db));
    channel.postMessage("changed");
    notify();
  };
  channel.onmessage = notify;
  window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });

  function subscribe(select, cb) {
    const run = () => cb(select(read()));
    listeners.add(run);
    run();
    return () => listeners.delete(run);
  }

  return {
    mode: "demo",
    async sendMessage(chatId, from, text) {
      const db = read();
      const now = Date.now();
      (db.messages[chatId] ||= []).push({ id: makeId(), from, text, ts: now });
      db.chats[chatId] = { ...(db.chats[chatId] || {}), ...chatMeta(from, text, now) };
      write(db);
    },
    onMessages: (chatId, cb) => subscribe((db) => db.messages[chatId] || [], cb),
    onChats: (cb) =>
      subscribe((db) =>
        Object.entries(db.chats).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.lastAt - a.lastAt), cb),
    onSettings: (cb) => subscribe((db) => ({ ...DEFAULT_SETTINGS, ...db.settings }), cb),
    async saveSettings(s) {
      const db = read();
      db.settings = { ...db.settings, ...s };
      write(db);
    },
    auth: {
      onChange: (cb) => { cb({ email: "demo@local" }); return () => {}; },
      signIn: async () => {},
      signOut: async () => {},
    },
  };
}

// ---------------------------------------------------------------
//  FIREBASE backend (Firestore + Google sign-in for the admin)
// ---------------------------------------------------------------
async function createFirebaseBackend() {
  const base = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-firestore.js"),
    import(base + "firebase-auth.js"),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const messagesRef = (chatId) => fs.collection(db, "chats", chatId, "messages");
  const logError = (err) => console.error("Firestore error:", err);

  return {
    mode: "firebase",
    async sendMessage(chatId, from, text) {
      const now = Date.now();
      await fs.addDoc(messagesRef(chatId), { from, text, ts: now });
      await fs.setDoc(fs.doc(db, "chats", chatId), chatMeta(from, text, now), { merge: true });
    },
    onMessages: (chatId, cb) =>
      fs.onSnapshot(
        fs.query(messagesRef(chatId), fs.orderBy("ts")),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        logError
      ),
    onChats: (cb) =>
      fs.onSnapshot(
        fs.query(fs.collection(db, "chats"), fs.orderBy("lastAt", "desc")),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        logError
      ),
    onSettings: (cb) =>
      fs.onSnapshot(
        fs.doc(db, "settings", "main"),
        (snap) => cb({ ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) }),
        logError
      ),
    async saveSettings(s) {
      await fs.setDoc(fs.doc(db, "settings", "main"), s, { merge: true });
    },
    auth: {
      onChange: (cb) => au.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)),
      signIn: () => au.signInWithPopup(auth, new au.GoogleAuthProvider()),
      signOut: () => au.signOut(auth),
    },
  };
}
