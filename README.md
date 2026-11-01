# Probably AI - a prank "AI" chat site (free to run)

Visitors chat with a fake AI. Behind the scenes **you** can read their
messages and answer live from a private admin page. If you are not around,
the site sends a silly scripted reply after a few seconds.

It uses only free services:
- **Firebase (Spark plan)** - stores messages and shows them live
- **GitHub Pages** (or Cloudflare Pages / Netlify) - hosts the web pages

## Try it right now (no account needed)

1. In this folder run: `python3 -m http.server 8000`
2. Open http://localhost:8000/index.html (the chat) and http://localhost:8000/admin.html
   (admin) in **two tabs of the same browser**.
3. Type in the chat tab. Reply from the admin tab, or wait 8 seconds for an auto-reply.

This is "demo mode": data stays in your own browser. To let real visitors use it,
connect Firebase (below).

## Go live (about 15 minutes)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with Google.
2. Click **Add project**, give it a name, and turn Google Analytics **off**.

### 2. Turn on the database
1. Left menu: **Build -> Firestore Database -> Create database**.
2. Pick a location near your visitors, choose **production mode**, click **Create**.
3. Open the **Rules** tab, delete everything, paste the contents of `firestore.rules`,
   **change `your-email@gmail.com` to your Google email**, and click **Publish**.

### 3. Turn on Google sign-in (for your admin page)
1. **Build -> Authentication -> Get started -> Sign-in method -> Google -> Enable -> Save**.

### 4. Get your config
1. Click the gear icon -> **Project settings** -> scroll to **Your apps** -> click the `</>` (web) icon.
2. Give it a nickname, click **Register app**.
3. Copy the `firebaseConfig = { ... }` block it shows.
4. Open `config.js` and paste it as shown in the comments there.
   Also set `ADMIN_EMAIL` to your Google email.
   (This config is not secret. The rules in step 2 are what protect your data.)

### 5. Put the site online (GitHub Pages)
1. Create a free account at https://github.com and make a new **public** repository.
2. Upload all files from this folder (the **Add file -> Upload files** button works).
3. Repository **Settings -> Pages -> Source: Deploy from a branch -> main / root -> Save**.
4. After a minute your site is at `https://YOURNAME.github.io/REPONAME/`.
   Your admin page is the same address with `admin.html` at the end.

### 6. Allow your website to use Google sign-in
1. Firebase console -> **Authentication -> Settings -> Authorized domains -> Add domain**.
2. Add `YOURNAME.github.io`.

Done. Open `admin.html`, sign in, and keep it open while you want to reply live.

## Changing the jokes
Edit `autoreplies.js`. Each line is one possible auto-reply (English and Chinese lists).

## Free-plan limits
The Firebase Spark plan has daily limits (roughly tens of thousands of reads and
thousands of writes per day). That is plenty for a small prank site. If it ever runs
out, the site simply stops working until the next day - you are never charged on
the Spark plan. Check the current limits at https://firebase.google.com/pricing.

## Be a good prankster
- The page footer says it is a parody site. Please keep it, so people know not to share private information.
- Don't use real AI brand names or logos.
- You can read what visitors type, so don't use this for anything sensitive.
