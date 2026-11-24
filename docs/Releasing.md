# Releasing

`.github/workflows/release.yml` publishes a version when a tag `vX.Y.Z` is pushed:

1. **build**: checks that the tag matches `version` in `package.json` and is on `master`, then runs lint, the tests, both builds, `web-ext lint`, and packages both builds.
2. **github-release**: a GitHub Release named after the tag, with `snaplinks-vX.Y.Z-firefox.zip` and `snaplinks-vX.Y.Z-chrome.zip` and notes generated from the merged pull requests.
3. **amo**: submits the Firefox build to [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/snaplinksplus/) on the listed channel. AMO reviews it, then offers it to every user as an update.
4. **chrome-web-store** and **edge-add-ons**: upload and submit the Chrome build (Manifest V3, the only version both stores accept).

The store jobs are independent: one store failing leaves the others and the GitHub Release alone. Re-run a failed job on its own from the run's page (**Re-run failed jobs**). Each runs only when its switch variable is `true`. So nothing is published to a store until you set it up, and forks never try.

## Cutting a release

```bash
# on master, with everything merged
npm version 3.1.17 --no-git-tag-version   # or edit "version" in package.json
git commit -am "Release 3.1.17"
git push origin master
git tag v3.1.17
git push origin v3.1.17
```

Then watch **Actions > Release**. To run a release again for an existing tag (eg: after fixing store credentials), use **Run workflow** and choose the tag (not a branch) under **Use workflow from**. The `release` environment only lets a run started from a `v*` tag read its secrets, so a run started from `master` stops at once.

`gulp publish` (signing from your machine with `insecure/Firefox/api-key.json`) still works. Use one or the other for a version, not both: AMO refuses a version it already has.

## One-time setup

### 1. The `release` environment

**Settings > Environments > New environment**, name it `release`.

- **Deployment branches and tags**: choose *Selected branches and tags* and add the tag rule `v*`. Only workflows started by a tag can then read its secrets. A pull request's workflow cannot.
- **Required reviewers**: add yourself, so every store job waits for your approval. A run uses the `release.yml` of the tagged commit, so its own checks (eg: that the tag is on `master`) only hold for a workflow file you have reviewed. The approval is what keeps the secrets from a tag pushed by anyone else.

### 2. Protect the version tags

**Settings > Rules > Rulesets > New tag ruleset**: target `v*` tags, add **Repository admin** to the bypass list, and turn on **Restrict creations**, **Restrict updates** and **Restrict deletions**. Only admins can then push, move or delete a version tag, which is what starts a release.

Add the secrets below to this environment (**Environment secrets**), not to the repository. Add the variables as **Repository variables** (**Settings > Secrets and variables > Actions > Variables**).

### 3. addons.mozilla.org (Firefox)

1. Sign in at <https://addons.mozilla.org/developers/addon/api/key/> with the account that owns Snap Links and generate credentials.
2. Environment secrets:
   - `AMO_JWT_ISSUER`: the **JWT issuer** (looks like `user:12345:67`)
   - `AMO_JWT_SECRET`: the **JWT secret**
3. Repository variable `PUBLISH_TO_AMO` = `true`.

These are the same two values as `insecure/Firefox/api-key.json` (`jwt_issuer`, `jwt_secret`).

### 4. Chrome Web Store

The item is `ikglmligndmabebhnicldebpekldnabm`, unpublished since Chrome removed Manifest V2. The Chrome Web Store API cannot create an item or fill in its listing, and it cannot publish an item whose listing or privacy practices are incomplete. So submit the first Manifest V3 version by hand in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole): upload the Chrome zip from the GitHub Release on **Package**, then fill in **Store listing** and **Privacy** with the answers in [ChromeWebStore.md](ChromeWebStore.md), and **Submit for review**. The workflow publishes the versions after that.

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Chrome Web Store API** (**APIs & Services > Library**).
2. **Google Auth Platform > Branding**: app name and your address. **Audience**: user type *External*, then **Publish app** so that the status is *In production*. Google shows an "unverified app" warning during step 4. Continue past it: the app is yours and only you sign in.
3. **Google Auth Platform > Clients > Create client**, type *Web application*, with the authorized redirect URI `https://developers.google.com/oauthplayground`. Keep its client ID and secret.
4. Get a refresh token in the [OAuth Playground](https://developers.google.com/oauthplayground):
   1. The gear icon: check **Use your own OAuth credentials** and enter the client ID and secret.
   2. **Step 1**: type the scope `https://www.googleapis.com/auth/chromewebstore`, **Authorize APIs**, and sign in with the account that owns the item.
   3. **Step 2**: **Exchange authorization code for tokens**, and copy the **Refresh token**.
5. Environment secrets, entered with `gh secret set <NAME> --env release` (it prompts for the value, so it stays out of the shell history): `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.
6. Repository variables:
   - `CWS_PUBLISHER_ID`: from the Developer Dashboard, **Account** section
   - `CWS_EXTENSION_ID`: `ikglmligndmabebhnicldebpekldnabm`
   - `PUBLISH_TO_CWS` = `true`

A refresh token of an OAuth app whose status is *Testing* expires after 7 days, so the app must be *In production* (step 2). The token also stops working if you revoke the app's access in your Google account. An alternative without a long-lived token is a [service account](https://developer.chrome.com/docs/webstore/service-accounts), which the API's V2 supports.

### 5. Microsoft Edge Add-ons

Like the Chrome Web Store, the API updates an existing product only: submit the first version in [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview), with the answers in [ChromeWebStore.md](ChromeWebStore.md).

1. In Partner Center, **Microsoft Edge > Publish API**, choose **Enable** (the v1.1 API, with API keys).
2. Environment secrets:
   - `EDGE_CLIENT_ID`: the **Client ID** shown there
   - `EDGE_API_KEY`: a new **API key**. It expires after 72 days; make a new one before then.
3. Repository variables:
   - `EDGE_PRODUCT_ID`: the product's id from its overview page (the GUID in the address bar; not the Store ID)
   - `PUBLISH_TO_EDGE` = `true`

## Trying it first

A fork runs the same workflow, and with no store variables set only **build** and **github-release** run. Push a tag that matches `package.json` to a fork to see a release made end to end, then delete the fork's release and tag.
