# Deploying to Cloudflare Pages (SPEC 51, card F-04)

**Status: done.** Cloudflare Pages is connected directly to this repo —
production branch `develop`, build command `npm run build`, output directory
`dist`, `NODE_VERSION` 22. Every merge to `develop` deploys automatically.

**Live:** <https://innana-seven-gates.pages.dev/>

This is Cloudflare's own git-connected build pipeline, not the Wrangler
direct-upload path this doc originally specified (below). That path counts
each deploy against the free plan's 500 **builds**/month; the direct-upload
alternative in `.github/workflows/ci.yml` (job `deploy`) does not, and stays
in the workflow as a dormant, unused alternative — it no-ops with a warning
because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` were never added as
repo secrets, per the design below. Switching to it later just means adding
those two secrets and removing the git-connected build from the Cloudflare
dashboard, so builds stop being double-counted.

<details>
<summary>Original design: Wrangler direct upload via GitHub Actions (removed from CI — see note)</summary>

> **Removed 2026-09-18.** The `deploy` job that implemented this was deleted from
> `.github/workflows/ci.yml`. It referenced `cloudflare/pages-action`, which
> Cloudflare has retired, so GitHub could not resolve the action and the job
> failed at *Set up job* on every push to `develop` — turning CI red regardless
> of whether the secrets it guarded were set. The per-step
> `if: steps.check.outputs.configured == 'true'` guards could not prevent this:
> Actions resolves every `uses:` reference before any step's `if` is evaluated.
> The live deploy never went through this job anyway. If direct upload is ever
> wanted, rebuild it on `cloudflare/wrangler-action` and verify the job resolves
> before merging.


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

## One-time setup (you, not a routine) — not the path actually used

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

- The deploy job only triggers on `push` to `develop` — not on `claude/**`
  branches and not on pull requests — so routine work-in-progress never
  deploys.
- Direct upload (what this job does) isn't metered by the 500 builds/month
  limit, so there's effectively no volume concern for how often `develop`
  merges.

</details>

## Staying inside the free plan (the path actually in use)

Cloudflare's git-connected build **is** metered by the 500 builds/month limit
— every push to `develop` counts. Cards merge here far less often than that,
so this hasn't been a concern in practice; revisit if merge volume ever climbs
enough to make 500/month tight, by adding the two repo secrets above and
switching to direct upload instead — which now means writing that job again, since the broken one was removed (see the collapsed section above).

## Rollback (SPEC 51)

Revert the offending commit on `develop` and push. Cloudflare's git
integration builds and publishes the new HEAD the same way it does every
other push.

## Custom domain (optional, not part of F-04)

Cloudflare Pages gives every project a free `*.pages.dev` subdomain
automatically — no extra setup needed for that. Attaching a custom domain is
a separate, optional step from the Pages project's **Custom domains** tab
whenever you want one.
