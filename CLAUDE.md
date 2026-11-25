# CLAUDE.md

Snap Links Plus: a Manifest V3 WebExtension (Firefox primary, Chrome secondary). The user drags a lasso with a mouse button (default RMB); links, checkboxes, radio buttons and clickable elements inside it are highlighted, then acted on (open in tabs, copy, toggle, click).

**Status: maintenance mode.** Inherited project. Prefer small, surgical bug fixes over refactors or new features. Do not "modernize" (modules, bundlers) unless asked.

## Commands

```bash
npm test            # jest, ~1s, tests/ only
npm run lint        # eslint src/ (currently clean; keep it that way)
npm run lint-fix
npm run build       # gulp: build/ff/ and build/chrome/
npx gulp watch      # DevBuild: includes Dev* files, rebuilds on change
npx gulp package    # also zips via web-ext into artifacts/
npm run run-ff      # Firefox Dev Edition with build/ff loaded, auto-reloads on rebuild (scripts/run-browser.mjs + .webext-run.cjs)
npm run run-chrome  # Chrome with build/chrome; run-edge for Edge.  Add `-- --windows` under WSL for the Windows browser
```

- `gulp publish` signs and uploads to AMO using `insecure/Firefox/api-key.json` (gitignored). Never run it unprompted.
- `run-ff` uses the persistent profile `SnapLinksDev/` (gitignored) and the `firefoxdeveloperedition` alias: Developer Edition on Windows/macOS, `firefox-developer-edition` on PATH on Linux/WSL. Set `FIREFOX=/path/to/firefox` to use another binary. Firefox refuses to run as root (Chrome without `--no-sandbox`), so as root the script re-runs itself as the owner of the project directory (`runuser`), and the config looks for `~/.local/bin/firefox-developer-edition` without relying on PATH.
- `run-chrome`/`run-edge` keep their profiles in `SnapLinksDev-chrome/`, `SnapLinksDev-edge/` (gitignored). On Linux they look for the binary in /usr/bin (set `CHROME`/`EDGE` to override): under WSL, chrome-launcher would pick the Windows Chrome, which web-ext cannot drive across WSL.
- `--windows` (WSL only) re-runs the script with the Windows `node.exe` (`WINDOWS_NODE` overrides `C:\Program Files\nodejs\node.exe`), so web-ext gives the browser Windows paths. Profiles go to `%LOCALAPPDATA%\SnapLinksDev\<browser>`. The project is read over `\\wsl.localhost`, where file change events do not arrive, so the rebuild watch polls (`WATCHPACK_POLLING`). WSL ends a Windows process on Ctrl+C with no signal it can catch, so `node.exe` runs in its own process group and the Linux side stops it by closing its stdin; it then closes the browser, and on Windows also ends the processes that name the profile (Firefox's launcher process leaves the real browser running otherwise).
- `scripts/run-browser.mjs` began as `run-ff.mjs`, because WSL2 mirrored networking resets (rather than refuses) connects to a not-yet-listening localhost port, and web-ext only retries on ECONNREFUSED. It wraps web-ext's `connect` from an internal path (`web-ext/lib/firefox/remote.js`), so re-check it after upgrading web-ext. Under WSL, Firefox renders through WSLg; the script sets `DISPLAY=:0` when the shell has no display set (ssh, some IDE terminals).
- Newer Firefox runs extensions on `file://` pages only after the user turns on "Access local files on your computer" for the extension (about:addons > Permissions; pref `extensions.webextensions.fileSchemeAccess.requireOptIn`). So every `run-*` serves `test/` (only) from a local http server and opens on `/`, a generated index of the fixture pages.
- Firefox caches parsed manifests by add-on id + version across restarts, so with an unchanged version a manifest edit (permissions) is ignored until the add-on reloads. `run-ff` deletes `SnapLinksDev/startupCache/webext.sc.lz4` before each start; while it runs, use Reload in about:debugging after a manifest change if the auto-reload did not pick it up.
- npm only (`package-lock.json` is the lockfile; CI runs `npm ci`). Don't reintroduce yarn.

## Build pipeline

1. `buildTmp`: copies `src/**/*.js|htm*` and `res/**/*.png` into `build/tmp/`, plus `webextension-polyfill` to `src/lib/`. Excludes `*Test*`, `*JetBrains*`, `*-compiled*`, `*Playground*`, `Dev*`.
2. `buildFor`: copies tmp to `build/ff` or `build/chrome` and renders `src/templates/manifest.hbs` (Handlebars with `{{#Firefox}}`, `{{#Chrome}}`, `{{#DevBuild}}`).
3. `gulp watch` removes the `!**/Dev*` exclusion and sets `DevBuild`, which adds `DevBuild.js` files and the `dev-do-*` commands to the manifest.

**Adding or reordering a source file means editing `manifest.hbs`.** Scripts are plain globals loaded in a fixed order (no imports). A script that uses a symbol from another must load after it. The same list governs content scripts, the background page, and `src/html/options.html` (which has its own `<script>` tags).

Version lives only in `package.json`. Chrome gets a derived 4-part `version`. The Firefox gecko block (`strict_min_version` 142.0, `data_collection_permissions: none`) is deliberate; see `CONTEXT-GRAPH.md`.

## Architecture

### Load order (content scripts, every frame, `<all_urls>`, `document_end`)

`browser-polyfill` (Chrome) → `StoragePrefs` → `CSP` → `globals` → `[DevBuild]` → `Utility` → `SelectionRect` → `ElementIndexer` → `SvgOverlay` → `CategorizedCollection` → `ActionMgr` → `EventHandler`

Background: `StoragePrefs` → `globals` → `[DevBuild]` → `background.js`. Firefox lists them in the manifest (an event page); Chrome's service worker `service-worker.js` loads the polyfill and then the same files with `importScripts()`, so keep both lists in step. The background reuses `globals.js` for constants and `Prefs`.

The background is a Firefox **event page** and a Chrome **service worker**: both browsers unload it after 30 s idle (Firefox: `extensions.background.idle.timeout`) and load it again for the next event, which clears every variable. Add listeners at the top level of `background.js`, never in a promise callback (Firefox only keeps listeners added while the script first runs, and only those wake the page). The waking event arrives before `Prefs` load, so handlers wait for `DOMReady`. State that must outlive the page goes to storage (`TabStacks` uses `storage.session`). Any extension API call resets the idle timer; `QueueOpen` keeps the page awake while links are queued. `run-ff` lowers `extensions.background.idle.timeout` to 5 s so unloads happen while testing; `terminateBackground()` in the Browser Console forces one. Each start re-applies the #400 context-menu setting, so `UpdateContextMenuSetting` writes it only when it differs. Chrome's worker has no DOM: `globals.js` must not touch `document`/`window` at load (`docElem` is undefined there), and copying goes through an offscreen document (`OffscreenClipboard.js`, `src/html/offscreen.html`, `src/lib/Offscreen.js`). Those Chrome-only files and `service-worker.js` are left out of the Firefox build (`FireFox.Exclude` in `gulpfile.js`).

### Drag lifecycle (`src/content-scripts/EventHandler.js`)

1. `mousedown` (capture) matches `Prefs.ActivateModifiers` + `ActivateMouseButton` → `BeginDrag`. `FirstInit` lazily builds `ActionMgr`, `RectMapper` (`ElemDocRects`), `ElementIndexer`, `SvgOverlayMgr`, `SelectionRect`.
2. A 30 ms interval (`onMouseMoveInterval`) autoscrolls and calls `SelectionRect.SetBottomRight`, which publishes `DragRectChanged`.
3. `ElementIndexer` builds a bucketed vertical index on first change (`UpdateIndex`), then `Search(rect)` returns a `CategorizedCollection` and publishes `ElementsSelected`. `SvgOverlayMgr` highlights them.
4. `mouseup` → `EndDrag` → publishes `DragCompleted` → **calls `ActionMgr.ActUpon` directly**, not via pub/sub. This is deliberate: browsers reject clipboard/tab/click actions outside a short-lived user-event handler.
5. `Escape` cancels. The next context menu is suppressed after a successful drag (`StopNextContextMenu`).
6. Linux/macOS right-drag (#400): while RMB activates, `background.js` sets Firefox's `browserSettings.contextMenuShowEvent` to `mouseup` (`UpdateContextMenuSetting`). On Linux only, when a native menu is open Firefox uses the next press to dismiss it, so `onRecoverContextMenuDrag` starts the drag from the first RMB-held `mousemove`. Frames share the menu-open state through the background (`GetContextMenuDragRecovery`, `SetContextMenuShown`). Tests: `test.ContextMenuSetting.js`, `test.ContextMenuRecovery.js`.

### Files

| File | Role |
|---|---|
| `src/CSP.js` | `pub(channel, msg)` / `sub(channel, fn)` (channel names lowercased; `sub` returns `{cancel}`). Also exports for jest. |
| `src/globals.js` | Constants, `DefaultPrefs`, channel names, `Prefs`, `DOMReady`, `MigratePrefs()`, misc helpers. Also monkey-patches `console.*` (they return arg 0) and `Function.prototype.wrap`. |
| `src/StoragePrefs.js` | Proxy over `browser.storage` (sync, falling back to local) layered on defaults; `onChanged()` observers. Reading an unknown key throws. |
| `src/DeepProxy.js` | Generic proxy helper, tested in `tests/`. |
| `ElementIndexer.js` | `RectMapper` (cached per-element document rects; A includes inner IMG/SVG, checkbox/radio includes labels; font-size/weight score cache) and `ElementIndexer` (bucket index, obscured-element check via `document.elementFromPoint` on the rect midpoint). |
| `CategorizedCollection.js` | Buckets elements into Links / Clickable / Checkboxes / RadioButtons; `GreatestType` picks the action. |
| `ActionMgr.js` | Acts on the greatest category. Links go to background via `runtime.sendMessage`. |
| `SelectionRect.js` | `Rect`/`DocRect` geometry and the lasso DOM (`DIV.SnapLinksContainer`, counter label). |
| `SvgOverlay.js` | SVG highlight layer; styles come from `Prefs.HighlightStyles_*`. |
| `background.js` | Messages: `OpenUrlsInTabs` (serialized on a promise chain; `TABS_OPEN_*` placement), `CopyToClipboard`, `ReloadExtension` (dev), context-menu timing and drag-recovery state (#400), install/update notifications (fixed ids, clicks handled by a top-level listener), the all-sites permission check on install/update (MV3), storage migration at 3.1.7. |
| `src/lib/Options.js`, `src/html/options.html` | Options page, driven by `DefaultPrefs` keys. |

### Preferences

Add a setting by putting a default in `DefaultPrefs` (`globals.js`), then a control in `options.html`. Rename or remove one by adding a step to `MigratePrefs()`. The 3.1.9 `OpenTabsAtEndOfTabBar` → `OpenTabs` migration is the model. `Dev_*` and `Debug_*` prefs are developer toggles and only act with `Prefs.DevMode`.

## Conventions

- Plain ES2020 scripts, `'use strict'`, **tabs** (width 4), LF, max line 200. Style details live in `.editorconfig` and `eslint/` (jQuery ruleset plus custom rules/globals).
- New cross-file globals must be added to `eslint/globals.js` and given a `/* exported X */` or `/* global X */` comment, or lint fails.
- `_` and `__` are reserved throwaway globals. `docElem` is `document.documentElement` (sandboxed-global cleanup is an open todo in `DevNotes.md`).
- Class methods are PascalCase in older code, camelCase in event handlers. Match the file you're in.
- JSDoc types throughout. Keep them accurate.
- Lines tagged `// #DevCode` are debug leftovers. Leave them alone.

## Testing

- Jest (`tests/**/*.js`, node environment by default). `tests/_support/` is the helper dir (excluded from test discovery).
- The browser scripts are plain globals with no exports, so tests load the real source with no changes to it:
  - `loadScripts(files, browser?, globals?)` runs them in a `vm` context (manifest order) with a mock `browser` (`makeBrowser()`). Use for logic that needs no DOM: `Rect`, `ActionMgr`, `StoragePrefs`, `background.js`.
  - `loadScriptsInDom(files, browser?, declare?)` runs them against jsdom; the test file needs a `@jest-environment jsdom` docblock. Use for `CategorizedCollection`, `ElementIndexer`/`RectMapper`. jsdom has no layout, so tests position elements by stubbing `getClientRects`, and `document.elementFromPoint`.
  - `tests/_support/dom.js` fakes layout for jsdom: `place(el, [top, left, bottom, right])`, `setDocumentSize`, `stubHitTesting` (`elementFromPoint`), `stubEmptyLayout`, and `trackListeners()`. Scripts attach listeners to the shared jsdom document, so call its returned cleanup in `afterEach`.
  - Both return `run(expr)`, which evaluates in the scripts' scope to reach top-level `let`/`class` bindings (`run('Rect')`, `run('Prefs = {...}')`). Globals owned by unloaded files (`ElemDocRects`, `LastModifierKeys`, `SvgOverlay`) are passed in `declare`.
- `test.Build.js` runs `gulp` and checks both manifests, referenced files, and byte-identical PNGs. It rewrites `build/`, so don't run it during `gulp watch`.
- `test.EventHandler.js` drives all content scripts with synthetic mouse events (drag, Escape, modifiers, autoscroll, actions), and is the best place to reproduce a lasso bug. jsdom has no real layout, so visual correctness (highlight placement, clipping, real hit-testing) still needs the manual check.
- `test.Options.js` loads the real `options.html` markup (URL set to `moz-extension://` via a docblock) and checks it against the code: every control id must be a `DefaultPrefs` key, select values must match the constants, and saves are throttled. Add a control to the page and this test tells you if the id is wrong.
- Verify layout-dependent behavior manually with the fixtures in `test/` (`test_links.html`, `issue308.htm`, `iframe_*.htm`, `overlapped_range.html`) using `npx gulp watch` + `npm run run-ff`, or by loading `build/ff` / `build/chrome` unpacked.
- `test.failing` marks a known bug. Remove `.failing` when you fix it.
- For a bug fix, write the failing test first; for layout-dependent code add a fixture page to `test/`.

## Gotchas

- MV3 applies the extension's content security policy to content scripts too: no `eval`/`new Function` anywhere (`test.Build.js` checks the build). Firefox treats MV3 host access (the content scripts' `<all_urls>`) as revocable by the user (an MV2 → MV3 update keeps it, see `CONTEXT-GRAPH.md`): `ALL_SITES_PERMISSION`, the options page note and `CheckSitesPermission()` handle a withdrawn one.
- A page's CSP (`style-src` without `'unsafe-inline'`) blocks a `<style>` element or `style` attribute a content script adds, in Firefox (#527). Style page elements through `element.style` only; the CSSOM is never subject to CSP (see `CONTEXT-GRAPH.md`).
- Runs in **every frame** of every page; be wary of anything heavy at load, and of global name collisions with page scripts (content scripts share an isolated world, but the extension's own files share one scope).
- Obscured-element detection samples only the rect midpoint; partly covered elements can be mis-classified (known idea in `DevNotes.md`).
- Gulp 5 pitfalls (both bit 3.1.16): `gulp.src` needs `{ encoding: false }` or it corrupts PNGs, and a positive glob listed after a `!negation` gets base `.` (options.html landed in `src/src/html/`). Keep positive globs first. `test.Build.js` guards both.
- Removed prefs aren't in `DefaultPrefs`, and `Prefs.<unknown>` throws. A migration must read them from `Prefs.Values` (see `MigratePrefs()`).
- `artifacts/`, `build/`, `insecure/`, `local/` are gitignored. `dist/` holds old release files, not build output. Never commit secrets from `insecure/`.

## Where else to look

- `DevNotes.md`: open bugs, ideas, and deferred features.
- `CONTEXT-GRAPH.md`: recorded decisions and lessons (manifest, web-ext, ESLint/Babel upgrades).
- `docs/` (GitHub Pages site: `History.md`, `Tutorial.md`, `Contributing.md`, `Updated.md`): user-facing docs; update `History.md` for user-visible changes.
- Issues: <https://github.com/cpriest/SnapLinksPlus/issues>
