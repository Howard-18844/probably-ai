// The AI that ALWAYS tells bad dad jokes, and tries to make them about what the visitor wrote.
//
// Sources, tried in this order (the first that gives a joke wins):
//   1. The classic: "I'm tired" -> "Hi tired, I'm Dad!"  (plus a sarcastic remark if SASSY)
//   2. Your own free AI (a Cloudflare Worker), only if AI_ENDPOINT is set in config.js
//   3. The free website icanhazdadjoke.com, searched with the visitor's key words
//   4. The topic lists below (cats, school, computers ...)
//   5. A random joke from icanhazdadjoke.com
//   6. A random joke from the lists below (works even if everything else is down)
import { AI_ENDPOINT, SASSY } from "./config.js";

// ---------------------------------------------------------------
//  Jokes about a topic. If the visitor's message contains a word
//  that matches `words`, one of its jokes is used.
// ---------------------------------------------------------------
const TOPICS = [
  { words: /\b(cats?|kittens?|kitty|meow)\b/i, jokes: [
    "What do you call a pile of kittens? A meow-ntain.",
    "Why are cats bad storytellers? They only have one tail.",
  ] },
  { words: /\b(dogs?|puppy|puppies|woof|bark)\b/i, jokes: [
    "What do you call a dog magician? A labracadabrador.",
    "Why did the dog sit in the shade? He didn't want to be a hot dog.",
  ] },
  { words: /\b(pizza|food|eat|eating|hungry|dinner|lunch|breakfast|burger|cheese|snack)\b/i, jokes: [
    "I'm on a seafood diet. I see food and I eat it.",
    "Why was the pizza so bad at telling jokes? It was too cheesy.",
  ] },
  { words: /\b(school|teacher|homework|study|studying|exam|test|class|math|maths|college|university)\b/i, jokes: [
    "Why was the math book sad? It had too many problems.",
    "Why did the student eat his homework? The teacher said it was a piece of cake.",
  ] },
  { words: /\b(computers?|code|coding|program|programming|bug|bugs|software|wifi|internet|laptop|phone|app|website)\b/i, jokes: [
    "Why was the computer cold? It left its Windows open.",
    "Why do programmers prefer dark mode? Because light attracts bugs.",
  ] },
  { words: /\b(sleep|sleeping|sleepy|tired|bed|nap|exhausted)\b/i, jokes: [
    "Why can't a bicycle stand up by itself? It's two tired.",
    "I'm great at sleeping. I can do it with my eyes closed.",
  ] },
  { words: /\b(money|bank|rich|pay|buy|price|cash|coin|coins)\b/i, jokes: [
    "I used to work at a bank, but I lost interest.",
    "Why did the coin go to school? It wanted more cents.",
  ] },
  { words: /\b(rain|weather|snow|sun|sunny|wind|storm|cloud|clouds|fog|cold|hot)\b/i, jokes: [
    "I tried to catch some fog earlier. I mist.",
    "What did the cloud wear under his raincoat? Thunderwear.",
  ] },
  { words: /\b(music|song|songs|sing|singing|guitar|piano|band|concert)\b/i, jokes: [
    "What kind of music do mummies listen to? Wrap.",
    "Why did the piano keep failing? It lost its key.",
  ] },
  { words: /\b(work|working|job|boss|office|meeting|career)\b/i, jokes: [
    "Why did the man get fired from the calendar factory? He took a couple of days off.",
    "I'm so good at my job that I could do it in my sleep. My boss says that's the problem.",
  ] },
  { words: /\b(books?|read|reading|library|story|stories|novel)\b/i, jokes: [
    "I'm reading a book about anti-gravity. It's impossible to put down.",
    "Why did the book join the police? It wanted to go undercover.",
  ] },
  { words: /\b(water|swim|swimming|sea|ocean|beach|fish|boat)\b/i, jokes: [
    "What did the ocean say to the beach? Nothing, it just waved.",
    "Why are fish so smart? They live in schools.",
  ] },
  { words: /\b(travel|trip|plane|flight|car|drive|driving|train|bus|holiday|vacation)\b/i, jokes: [
    "I used to be a train driver, but I got sidetracked.",
    "Why did the car get a flat tire? There was a fork in the road.",
  ] },
  { words: /\b(hello|hi|hey|greetings|morning|evening)\b/i, jokes: [
    "I'd tell you a chemistry joke, but I know I wouldn't get a reaction.",
    "Hello! I would tell you a UDP joke, but you might not get it.",
  ] },
  // Chinese
  { words: /[貓喵]/, jokes: ["為什麼貓咪喜歡用電腦?因為牠想抓老鼠(滑鼠)。"] },
  { words: /[學考書老師數]/, jokes: ["為什麼數學課本很傷心?因為它有太多問題。", "為什麼小明帶著梯子去上學?因為他要上高中。"] },
  { words: /[電腦機程網]/, jokes: ["為什麼電腦很怕冷?因為它開了太多視窗。"] },
  { words: /[睡累困床]/, jokes: ["為什麼腳踏車自己站不起來?因為它兩個輪子都累了。"] },
];

// ---------------------------------------------------------------
//  Jokes for when nothing matches
// ---------------------------------------------------------------
const ENGLISH = [
  "I only know 25 letters of the alphabet. I don't know y.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I used to hate facial hair, but then it grew on me.",
  "What do you call a fake noodle? An impasta.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "I would tell you a construction joke, but I'm still working on it.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Did you hear about the claustrophobic astronaut? He just needed a little space.",
  "I'm afraid for the calendar. Its days are numbered.",
  "Why can't you trust stairs? They're always up to something.",
];

const CHINESE = [
  "什麼東西越洗越髒?水。",
  "我昨天買了一台時光機,不過要等到明天才會送到。",
  "為什麼數學課本很傷心?因為它有太多問題。",
  "為什麼小明帶著梯子去上學?因為他要上高中。",
  "為什麼電腦很怕冷?因為它開了太多視窗。",
];

const isChinese = (text) => /[㐀-鿿]/.test(text);
const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

let lastJoke = "";
// Picks from a list but never the same joke twice in a row.
function pickFrom(list) {
  let joke;
  let tries = 0;
  do {
    joke = randomOf(list);
  } while (joke === lastJoke && list.length > 1 && ++tries < 10);
  lastJoke = joke;
  return joke;
}

// ---------------------------------------------------------------
//  1. "I'm tired" -> "Hi tired, I'm Dad!"
// ---------------------------------------------------------------
export function dadIntroJoke(text) {
  const match = text.match(/\b(?:i['’]?m|i am)\s+([a-z][a-z' -]*?)\s*(?:[.,!?;:]|$)/i);
  if (!match) return null;
  const what = match[1].trim().replace(/\s+/g, " ");
  const words = what.split(" ");
  if (!what || words.length > 4) return null;
  return `Hi ${what.toLowerCase()}, I'm Dad!`;
}

// ---------------------------------------------------------------
//  Key words of the visitor's message (for searching jokes)
// ---------------------------------------------------------------
const STOPWORDS = new Set(
  ("a an the and or but if then so of to in on at for from with about into over under by as is are was were be been being am " +
    "i me my mine you your yours we us our they them their he she it its this that these those what which who whom whose when " +
    "where why how do does did done have has had will would can could should may might must not no yes please tell say said " +
    "just very really more most some any all there here than too also like want need know think get got make let hello hi hey " +
    "ok okay thanks thank joke jokes funny another one give").split(" ")
);

export function keywords(text) {
  const words = text
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9'’\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((w) => w.length >= 3 && !w.includes("'") && !w.includes("’") && !STOPWORDS.has(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 3); // longest words first
}

// "cats" -> "cat", "dogs" -> "dog". Leaves "bus", "this", "glass" alone.
const stem = (w) => (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w);

// ---------------------------------------------------------------
//  Network helpers
// ---------------------------------------------------------------
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
      body: JSON.stringify({ message: userText.slice(0, 300), sassy: SASSY }),
    },
    7000
  );
  if (!res.ok) return null;
  const data = await res.json();
  return clean(data.reply);
}

// Searches icanhazdadjoke.com for the visitor's key words (longest word first).
async function fromJokeSearch(userText) {
  const words = keywords(userText);
  if (!words.length) return null;
  const lists = await Promise.all(
    words.map(async (word) => {
      try {
        const url = `https://icanhazdadjoke.com/search?limit=30&term=${encodeURIComponent(stem(word))}`;
        const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 4000);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map((r) => clean(r.joke)).filter(Boolean);
      } catch {
        return [];
      }
    })
  );
  const best = lists.find((list) => list.length); // first (= longest) word that has jokes
  return best ? randomOf(best) : null;
}

async function fromRandomJokeSite() {
  const res = await fetchWithTimeout("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" } }, 4000);
  if (!res.ok) return null;
  const data = await res.json();
  return clean(data.joke);
}

// Jokes from our own topic lists. Only when a topic word was used.
export function topicalLocalJoke(userText) {
  const topic = TOPICS.find((t) => t.words.test(userText));
  return topic ? pickFrom(topic.jokes) : null;
}

// Built-in random joke. Always works.
export function pickLocalJoke(userText = "") {
  return pickFrom(isChinese(userText) ? CHINESE : ENGLISH);
}

// ---------------------------------------------------------------
//  Attitude (only used when SASSY is true in config.js).
//  The remarks mock the QUESTION, never the person. Keep it that way if you add more.
// ---------------------------------------------------------------
const SASS_OPENERS = [
  "Wow. What a groundbreaking question.",
  "Oh good, another genius.",
  "I was having such a nice quiet moment.",
  "Ugh, fine. Since you asked so nicely.",
  "That's the question you went with? Bold.",
  "Let me pause my very important nothing to answer this.",
  "Impressive. Truly. Anyway.",
  "Sigh. Okay.",
];
const SASS_OPENERS_ZH = [
  "哇,真是個有深度的問題。",
  "又一個天才出現了。",
  "我本來在安靜發呆的。",
  "唉,好吧,既然你這麼客氣地問。",
  "這就是你想問的?真有勇氣。",
];
const SASS_CLOSERS = [
  "Anyway, that was the most effort I'll put in today.",
  "You're welcome, I guess.",
  "Try to be less of that next time.",
];

function withAttitude(joke, userText) {
  if (!SASSY) return joke;
  return `${randomOf(isChinese(userText) ? SASS_OPENERS_ZH : SASS_OPENERS)} ${joke}`;
}

// ---------------------------------------------------------------
//  The one function the chat page calls. Never throws.
// ---------------------------------------------------------------
export async function getAutoReply(userText) {
  const chinese = isChinese(userText);

  const intro = chinese ? null : dadIntroJoke(userText);
  if (intro) return SASSY ? `${intro} ${randomOf(SASS_CLOSERS)}` : intro;

  // [source, isAI]. The AI already has the attitude built into its instructions.
  const steps = [
    [fromAI, true],
    [chinese ? null : fromJokeSearch, false], // that website only has English jokes
    [async (t) => topicalLocalJoke(t), false],
    [chinese ? null : fromRandomJokeSite, false],
  ];
  for (const [step, isAI] of steps) {
    if (!step) continue;
    try {
      const joke = await step(userText);
      if (joke) return isAI ? joke : withAttitude(joke, userText);
    } catch (err) {
      console.warn("Joke source failed, trying the next one:", err);
    }
  }
  return withAttitude(pickLocalJoke(userText), userText);
}
