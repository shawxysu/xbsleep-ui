# 早睡积分站 — GitHub Pages SPA

A dependency-free, one-page application that records point gains and reward draws by committing `state.json` through the GitHub REST API.

## Architecture

Use **two repositories**:

1. **Public frontend repository** — contains these files and is published with GitHub Pages.
2. **Private data repository** — stores only `state.json`; every gain or consume operation updates the file and creates a Git commit.

This avoids publishing sleep history in the Pages repository. The Pages website itself remains reachable publicly unless your GitHub plan supports private Pages.

## 1. Create the private data repository

Create a private repository, for example `sleep-points-data`, and initialize it with a README so that the `main` branch exists. The app creates `state.json` on the first successful operation.

## 2. Create a fine-grained personal access token

Create a fine-grained PAT with:

- Resource owner: your account
- Repository access: **only** `sleep-points-data`
- Repository permissions: **Contents — Read and write**
- A short expiration period

Do not put the token in `config.js`, Git, browser storage, screenshots, or issue comments.

## 3. Configure the frontend

Edit `config.js` only for public site behavior:

```js
DATA_BRANCH: "main",
STATE_PATH: "state.json",
APP_TITLE: "我们的早睡养肤小约定",
```

Edit the `REWARDS` arrays to set the actual SSR, SR, and R rewards.

The private data repository is no longer hard-coded in `config.js`. Enter it on the page in the **小账本位置** field, for example `your-github-username/sleep-points-data`. A full GitHub repo URL such as `https://github.com/your-github-username/sleep-points-data` also works.

## 4. Publish with GitHub Pages

Create a public repository for the frontend and push this directory to its `main` branch. In repository settings:

- Open **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: `main`
- Folder: `/(root)`

The included `.nojekyll` file makes GitHub Pages serve the static files directly.

## 5. Save the token in Chrome Password Manager

Chrome autofill is heuristic; a website cannot force it. The reliable setup is to add an entry manually:

- Website: the exact Pages origin, such as `https://your-name.github.io`
- Username: `your-github-username/sleep-points-data`
- Password: the fine-grained PAT

On the app, select the saved credential in the token field if Chrome does not fill it automatically.

The app clears the visible token field after connecting. It keeps the token only in JavaScript memory for the lifetime of the tab; refreshing or disconnecting removes it.

## Scoring implemented

- Before 01:00: +1
- 01:00–01:59: +0.5
- 02:00–02:59: +0
- 03:00 or later: +0 and invalidates that week's streak bonus
- One rescue card per calendar month: the selected night counts as before 01:00
- Completed Monday–Sunday week with at least 5 scoring nights: +1
- Completed week with all 7 nights scoring: +1 additional

Weekly bonuses are added to spendable balance only after the week finishes. This prevents a provisional bonus from being spent and then revoked by a later 03:00+ night.

## Record updates

Sleep records are append-only. Saving a date that already has a record creates a new `gain` operation, and the newest operation for that date overrides earlier ones for balance, weekly streaks, the calendar, and the monthly rescue-card check. Older entries stay in `state.json` as history.

When a recorded date is selected in the form, the app fills in that date's current effective sleep time and rescue-card checkbox so the record can be adjusted quickly.

## Gacha implemented

- Each draw costs 1 point.
- SSR pulls 1–40: 0.6%.
- SSR pulls 41–50: `(pull - 40) × 10%`; pull 50 is guaranteed.
- SR base chance: 6% after the SSR check.
- If the first 8 pulls after an SR-or-better contain no SR/SSR, pull 9 is at least SR.
- SSR resets both pity counters; SR resets the SR counter.
- Randomness uses browser crypto when available, with a compatibility fallback for older mobile browsers.
- Draw results open a confirmation modal and play the matching local video from `assets/r.mp4`, `assets/sr.mp4`, or `assets/ssr.mp4`.

## Security limits

This is a static, browser-authenticated design. Any JavaScript executing on the same page while the token is present could act with the token's permissions. Mitigations included here:

- No third-party scripts or packages
- Restrictive Content Security Policy
- No token persistence in web storage or cookies
- Repository-scoped fine-grained token
- State rendered with `textContent`, not injected HTML

For stronger security, put GitHub authentication behind a server-side GitHub App or serverless API. That prevents the repository write credential from entering the browser at all.

## Local testing

Opening `index.html` via `file://` may not behave like GitHub Pages. Serve the directory locally instead:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You can test the app without saving anything to the real private ledger: keep the default **小账本位置** value `local-demo`, leave the private-key field empty, and press **进入小站**. Local trial mode starts with 100 points so draws can be tested immediately. Refreshing the page clears the local trial records.

`local-demo` is only the hidden trial trigger, and it works from a phone too. For real use, replace it with the private ledger repo location before entering the private key.
