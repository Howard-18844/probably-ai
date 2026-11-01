# Free dad-joke AI (optional upgrade)

Your site already tells bad dad jokes with no setup: it asks the free website
icanhazdadjoke.com, and uses a built-in list if that website is down.

This page is about the **optional upgrade**: your own AI that makes up a new bad dad
joke about whatever the visitor typed. It runs on Cloudflare's free plan.

## Why a "Worker" and not the AI directly in the page?
Anything inside a GitHub Pages site is public, so a secret AI key put there could be
copied by anyone. A Cloudflare Worker is a tiny program that runs on Cloudflare's
computers. It can use Cloudflare's AI without any key, and the page only talks to
the Worker.

## Steps (about 10 minutes)

1. Go to https://dash.cloudflare.com and create a free account (no credit card needed
   as far as I know).
2. Left menu: **Workers & Pages -> Create -> Create Worker**.
3. Name it `probably-ai-jokes` and click **Deploy**.
4. Click **Edit code**. Delete everything in the editor, paste the whole content of
   `worker.js` from this folder, and click **Deploy**.
5. Go to the Worker's **Settings -> Bindings -> Add -> Workers AI**.
   Set the **Variable name** to exactly `AI` and click **Deploy**.
6. Copy your Worker's address from the top of the page. It looks like
   `https://probably-ai-jokes.YOURNAME.workers.dev`.
7. Open `config.js`, put that address between the quotes of `AI_ENDPOINT`, save, then
   commit and push to GitHub (see "Updating the site" below).

## Test the Worker (optional)
In PowerShell (replace the address with yours):

```powershell
Invoke-RestMethod -Method Post -Uri "https://probably-ai-jokes.YOURNAME.workers.dev" `
  -Headers @{ Origin = "https://howard-18844.github.io" } `
  -ContentType "application/json" -Body '{"message":"cats"}'
```

You should see something like `reply : Why did the cat sit on the computer? ...`

## Updating the site after you change files
In a terminal inside this folder:

```
git add .
git commit -m "dad joke AI"
git push
```

Wait 1-2 minutes, then refresh the site with Ctrl+Shift+R.

## Good to know
- **Free limits:** Cloudflare gives a free daily amount of Workers requests and AI
  usage (check https://developers.cloudflare.com/workers-ai/platform/pricing/ for the
  current numbers). If the free amount runs out, the Worker returns an error and the
  site automatically falls back to the free joke website, so visitors still get jokes.
- **Who can use your Worker:** it only answers web pages on the addresses listed at
  the top of `worker.js`. This stops casual copying, but it is not a perfect lock.
  Someone determined could still send requests to it directly and use up your free
  amount. The fallback keeps the site working if that happens.
- **Model names:** Cloudflare retires old AI models from time to time. (That happened
  to the first model I picked, `@cf/meta/llama-3.1-8b-instruct`, which was retired on
  May 30, 2026.) `worker.js` tries the models in its `MODELS` list one after another.
  If the Worker ever answers `{"error":"ai failed","detail":[...]}`, the `detail` shows
  why. Then pick a current text model from https://developers.cloudflare.com/workers-ai/models/
  and put its name in the `MODELS` list. Cheaper models use less of your free daily amount.
- **Changing the personality:** edit `SYSTEM_PROMPT` in `worker.js`, for example to ask
  for only food puns.
