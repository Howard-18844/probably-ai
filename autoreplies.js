// Silly scripted answers used when you are not replying live.
// Add, remove or rewrite lines freely.
const ENGLISH = [
  "Great question! Unfortunately my brain is buffering. Estimated time: 16 months.",
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "I would answer that, but I am legally required to take a nap first.",
  "Error 418: I'm a teapot. Would you like a poem about teapots instead?",
  "Let me consult my sources... my sources say \"ask someone else\".",
  "Processing... 1%... 2%... 3%... (this may take a while)",
  "As a large language model I would love to help. As a medium-sized one, I can only wave.",
  "I asked another AI and it left me on read.",
  "Sorry, the hamster that powers my servers is on a break.",
  "Could you rephrase that as an interpretive dance? I find it easier.",
];

const CHINESE = [
  "好問題!我的大腦正在緩衝中,預計需要 16 個月。",
  "啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊",
  "我本來想回答,但我依法必須先睡個午覺。",
  "正在思考中... 1%... 2%... 3%...(可能要等一陣子)",
  "我問了另一個 AI,牠已讀不回。",
  "抱歉,負責驅動伺服器的倉鼠正在休息。",
];

let lastIndex = -1;

export function pickAutoReply(userText) {
  const list = /[㐀-鿿]/.test(userText) ? CHINESE : ENGLISH;
  let i;
  do {
    i = Math.floor(Math.random() * list.length);
  } while (i === lastIndex && list.length > 1);
  lastIndex = i;
  return list[i];
}
