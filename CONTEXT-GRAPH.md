---

## 2026-03-09 SnapLinks3

### Lesson Learned: eslint-plugin-import was unused
**Discovery:** `eslint-plugin-import@2.32.0` was listed as a devDependency but never referenced in `eslint.config.js` or any custom rules files.
**Context:** Surfaced as a peer dependency conflict when upgrading `@babel/core` — it doesn't support ESLint 10.
**Application:** When a peer dep conflict arises during install, check whether the conflicting package is actually used before reaching for `--legacy-peer-deps`. Removing it was the cleaner fix.

### Lesson Learned: web-ext 9.x dropped .js config file support
**Discovery:** web-ext 9.0+ no longer accepts `.js` config files; must use `.cjs` (CommonJS) or `.mjs` (ES module).
**Context:** Upgrading web-ext 8.x → 9.4.0.
**Application:** Rename `.webext-*.js` → `.webext-*.cjs` and update any script references in `package.json`. Config content (module.exports) stays the same.

### Lesson Learned: Firefox manifest `applications` key is deprecated
**Discovery:** `applications` in the Firefox manifest must be replaced with `browser_specific_settings` for MV2+; web-ext lint will warn `APPLICATIONS_DEPRECATED`.
**Context:** Running `web-ext lint` after upgrading to web-ext 9.4.0.
**Application:** Always use `browser_specific_settings.gecko` in the manifest template.

### Lesson Learned: data_collection_permissions schema constraints
**Discovery:** `data_collection_permissions.required` has `minItems: 1` — empty arrays are invalid. For extensions that collect no data, use `"required": ["none"]`. The `optional` key can be omitted entirely.  Feature requires Firefox 142+ (Android); set `strict_min_version` to `142.0` to avoid version mismatch warnings.
**Context:** Fixing `MISSING_DATA_COLLECTION_PERMISSIONS` lint warning in web-ext 9.4.0.
**Application:** Add to gecko block in manifest.hbs:
```json
"data_collection_permissions": {
"required": ["none"]
}
```
and set `"strict_min_version": "142.0"`.

### Decision: Bump strict_min_version to 142.0
**Context:** Adding `data_collection_permissions` to the Firefox manifest. The field was introduced in Firefox 140 (desktop) and 142 (Android).
**Decision:** Set `strict_min_version` to `142.0` to satisfy both desktop and Android requirements.
**Reasoning:** Silences both `KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION` warnings cleanly. Firefox 142 is recent but the extension targets modern browsers; the old floor of 63.0 was very stale.
**Alternatives Considered:** Keeping 63.0 and accepting the warnings — rejected as noise in CI lint output.
**Outcome:** Lint warnings reduced from 7 to 5 (only pre-existing code-quality warnings remain).

### Decision: Dependency cleanup and audit baseline (2026-11-19)
**Context:** `npm audit` showed 44 dev-only findings (4 critical). Production (`--omit=dev`) had none.
**Decision:** Removed unused devDependencies (`@babel/core`, `crx`, `run-sequence`, `gulp-replace`, `gulp-zip`, `gulp-sourcemaps`) and the unused `lit-element` dependency. Upgraded web-ext 9.4 → 10.8, eslint 10.15, jest 30.5.2, then `npm audit fix`.
**Reasoning:** Jest pulls in its own `@babel/core`; a direct pin only risks a babel 8 / jest mismatch. Nothing in `src/`, the gulpfile or the manifest referenced the others.
**Accepted residue:** 20 moderate findings, all inside jest's own tree (`glob`, `minimatch`, `uuid` via the optional `node-notifier`). npm's only offered fix is a downgrade to jest 26. They affect local test tooling only. Re-check when jest 31 ships.
**Outcome:** 0 critical, 0 high. `scripts/run-ff.mjs` verified against web-ext 10.8 (`connect` in `lib/firefox/remote.js` and the `firefoxClient` run option are unchanged).

---

## 2026-11-22 Manifest V3 (Firefox)

### Decision: Firefox moves to Manifest V3 with an event page; Chrome keeps its Manifest V2 manifest in this change
**Context:** MV3 is Firefox's current manifest version (generally available since Firefox 109; `strict_min_version` is already 142). Chrome removed MV2 in Chrome 139, so the Chrome build had not loaded in Chrome or Chromium since then; Edge 158 still loads it.
**Decision:** Firefox: `manifest_version: 3`, `background.scripts` (an event page, the only MV3 background Firefox supports), no `persistent`, `options_ui` without `chrome_style`. Same permissions, same gecko id. Chrome: its MV3 move needs a service worker and an offscreen document for copying, done as a separate change.
**Alternatives Considered:** Firefox `background.service_worker`: not supported by Firefox. Adding `host_permissions: ["<all_urls>"]`: not needed, Firefox treats the content scripts' matches as the requested host access, and least privilege.

### Lesson Learned: Firefox keeps only the event page listeners added while its script first runs
**Discovery:** `EventManager` records a listener as persistent only while `context.listenerPromises` is set, which Firefox clears once background startup completes (`ext-backgroundPage.js`, `ExtensionCommon.sys.mjs`, Firefox 160). Only recorded listeners wake a suspended page. `runtime.sendMessage` waits for the woken page's startup, then delivers to the listeners present.
**Context:** `background.js` added `runtime.onMessage` in `DOMReady.then()`, after the storage reads. On a woken page the action message reached only the context-menu listener and was dropped. Notification click listeners were added when the notification was shown.
**Application:** Add every listener at the top level of `background.js`. Handlers that read `Prefs` wait for `DOMReady`: primed events (`storage.onChanged`, `notifications.onClicked`) can fire before DOMContentLoaded, when `Prefs` does not exist yet.

### Lesson Learned: what keeps an event page loaded
**Discovery:** Firefox resets the 30 s idle timer (`extensions.background.idle.timeout`) on every extension API call from the background into the parent process ("parentapicall"). A listener's pending promise defers termination once. Nothing else (timers, pending fetches) does.
**Application:** Opening tabs resets it per tab, but a `NewTabDelayMS` over the timeout would unload the page between tabs. `QueueOpen` calls `runtime.getPlatformInfo()` every 10 s while links are queued. State that must outlive the page goes to storage: `TabStacks` in `storage.session`.

### Lesson Learned: MV3 host access is revocable; an MV2 → MV3 update keeps it
**Discovery:** With `originControls` (MV3), Firefox treats the manifest's origins (`host_permissions` and content script `matches`) as optional: granted at install (`extensions.originControls.grantByDefault`), and the user can withdraw them in about:addons or per site. On an update, `ExtensionData.migratePermissions()` grants the permissions the old version required that the new one makes optional, so the MV2 content scripts' `<all_urls>` carries over. Because they count as optional origins, `permissions.request({ origins: ['<all_urls>'] })` may ask for them again, without `optional_host_permissions`.
**Verified:** Firefox Developer Edition 161 (Linux), permanent installs: 3.1.16 (MV2) updated by 3.1.17 (MV3) keeps `<all_urls>`, the preferences, and works on pages at once; no options page opens. (Temporary installs, as in about:debugging, also get host access, so they cannot show this.)
**Application:** As Mozilla's migration guide asks, the extension checks for it: `ALL_SITES_PERMISSION`; `CheckSitesPermission()` opens the options page after an install or update without it; the options page shows "Allow on all websites" while it is missing.

### Lesson Learned: MV3 changes outside the background
- The extension CSP applies to content scripts too: no `eval` / `new Function` (RateReporter used it). `test.Build.js` scans the build.
- `options_ui.browser_style` defaulted to true in MV2 and is not supported in MV3; without it the page fell back to a serif font, page margins and collapsed label margins. `options.html` now sets the flex column, `font: caption` and zero margins that `extension.css` gave it; screenshots of the page in about:addons before and after match.
