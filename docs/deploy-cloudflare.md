# Deploying to Cloudflare Pages (SPEC 51, card F-04)

Every push to `develop` builds the game and, once you've done the one-time
setup below, publishes it to Cloudflare Pages automatically. The deploy job
(`.github/workflows/ci.yml`, job `deploy`) only runs after the `test` and
`e2e` jobs pass, so a broken build never goes live.

This uses [Wrangler direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
via `cloudflare/pages-action`, not Cloudflare's own git-connected build
pipeline. GitHub Actions builds the app and hands Cloudflare the finished
`dist/` folder, so nothing on Cloudflare's side compiles the project. That
means these deploys don't count against the free plan's 500 **builds**/month
at all — direct uploads are a separate, much higher limit.

## One-time setup (you, not a routine)

1. **Create a free Cloudflare account** at <https://dash.cloudflare.com/sign-up>
   if you don't already have one.

2. **Create the Pages project once**, so the first deploy has somewhere to
   land:
   - In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
     Upload assets**, name the project `inanna-seven-gates`, and upload any
     placeholder file to finish creation. (The next deploy from CI replaces
     it.)
   - Or from your machine, with the repo checked out: `npx wrangler login`
     then `npx wrangler pages project create inanna-seven-gates`.

3. **Create an API token** the deploy job can use:
   - Dashboard → your profile icon → **My Profile → API Tokens → Create
     Token**.
   - Use the **"Edit Cloudflare Workers"** template, or a custom token with
     the **Account → Cloudflare Pages → Edit** permission. Scope it to your
     account.

4. **Find your Account ID**: dashboard → **Workers & Pages** → it's listed in
   the right-hand sidebar (or on any zone's Overview page).

5. **Add two repository secrets** (GitHub repo → **Settings → Secrets and
   variables → Actions → New repository secret**):
   - `CLOUDFLARE_API_TOKEN` — the token from step 3.
   - `CLOUDFLARE_ACCOUNT_ID` — the ID from step 4.

That's it. The next push to `develop` deploys. Until these secrets exist, the
`deploy` job detects that and skips itself with a warning instead of failing,
so it never blocks CI or certification.

## Staying inside the free plan

- The deploy job only triggers on `push` to `develop` — not on `claude/**`
  branches and not on pull requests — so routine work-in-progress never
  deploys.
- Direct upload (what this job does) isn't metered by the 500 builds/month
  limit, so there's effectively no volume concern for how often `develop`
  merges.

## Rollback (SPEC 51)

Revert the offending commit on `develop` and push. That produces a new green
build, which the `deploy` job publishes the same way.

## Custom domain (optional, not part of F-04)

Cloudflare Pages gives every project a free `*.pages.dev` subdomain
automatically — no extra setup needed for that. Attaching a custom domain is
a separate, optional step from the Pages project's **Custom domains** tab
whenever you want one.
