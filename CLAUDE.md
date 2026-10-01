# CLAUDE.md

Snap Links Plus: a Manifest V2 WebExtension (Firefox primary, Chrome secondary). The user drags a lasso with a mouse button (default RMB); links, checkboxes, radio buttons and clickable elements inside it are highlighted, then acted on (open in tabs, copy, toggle, click).

**Status: maintenance mode.** Inherited project. Prefer small, surgical bug fixes over refactors or new features. Do not "modernize" (MV3, modules, bundlers) unless asked.

## Commands

```bash
npm test            # jest, ~1s, tests/ only
npm run lint        # eslint src/ (currently clean; keep it that way)
npm run lint-fix
npm run build       # gulp: build/ff/ and build/chrome/
npx gulp watch      # DevBuild: includes Dev* files, rebuilds on change
npx gulp package    # also zips via web-ext into artifacts/
npm run run-ff      # web-ext run against build/ff (config: .webext-ff.cjs)
```

- `gulp publish` signs and uploads to AMO using `insecure/Firefox/api-key.json` (gitignored). Never run it unprompted.
- `.webext-ff.cjs` is Windows-flavored (`firefoxdeveloperedition`, backslash watch path, profile `SnapLinksDev`); adjust locally, don't commit machine-specific edits.
- `gulpfile.js` `webext()` shells out to `yarn run web-ext`, and CI (`.github/workflows/nodejs.yml`) uses `yarn`, while day-to-day work uses npm. `yarn.lock` is gitignored.

## Build pipeline

1. `buildTmp`: copies `src/**/*.js|htm*` and `res/**/*.png` into `build/tmp/`, plus `webextension-polyfill` to `src/lib/`. Excludes `*Test*`, `*JetBrains*`, `*-compiled*`, `*Playground*`, `Dev*`.
2. `buildFor`: copies tmp to `build/ff` or `build/chrome` and renders `src/templates/manifest.hbs` (Handlebars with `{{#Firefox}}`, `{{#Chrome}}`, `{{#DevBuild}}`).
3. `gulp watch` removes the `!**/Dev*` exclusion and sets `DevBuild`, which adds `DevBuild.js` files and the `dev-do-*` commands to the manifest.

**Adding or reordering a source file means editing `manifest.hbs`.** Scripts are plain globals loaded in a fixed order (no imports). A script that uses a symbol from another must load after it. The same list governs content scripts, the background page, and `src/html/options.html` (which has its own `<script>` tags).

Version lives only in `package.json`. Chrome gets a derived 4-part `version`. The Firefox gecko block (`strict_min_version` 142.0, `data_collection_permissions: none`) is deliberate; see `CONTEXT-GRAPH.md`.

## Architecture

### Load order (content scripts, every frame, `<all_urls>`, `document_end`)

`browser-polyfill` (Chrome) → `StoragePrefs` → `CSP` → `globals` → `[DevBuild]` → `Utility` → `SelectionRect` → `ElementIndexer` → `SvgOverlay` → `CategorizedCollection` → `ActionMgr` → `EventHandler`

Background page: polyfill (Chrome) → `StoragePrefs` → `globals` → `[DevBuild]` → `background.js`. The background reuses `globals.js` for constants and `Prefs`.

### Drag lifecycle (`src/content-scripts/EventHandler.js`)

1. `mousedown` (capture) matches `Prefs.ActivateModifiers` + `ActivateMouseButton` → `BeginDrag`. `FirstInit` lazily builds `ActionMgr`, `RectMapper` (`ElemDocRects`), `ElementIndexer`, `SvgOverlayMgr`, `SelectionRect`.
2. A 30 ms interval (`onMouseMoveInterval`) autoscrolls and calls `SelectionRect.SetBottomRight`, which publishes `DragRectChanged`.
3. `ElementIndexer` builds a bucketed vertical index on first change (`UpdateIndex`), then `Search(rect)` returns a `CategorizedCollection` and publishes `ElementsSelected`. `SvgOverlayMgr` highlights them.
4. `mouseup` → `EndDrag` → publishes `DragCompleted` → **calls `ActionMgr.ActUpon` directly**, not via pub/sub. This is deliberate: browsers reject clipboard/tab/click actions outside a short-lived user-event handler.
5. `Escape` cancels. The next context menu is suppressed after a successful drag (`StopNextContextMenu`).

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
| `background.js` | Messages: `OpenUrlsInTabs` (serialized on a promise chain; `TABS_OPEN_*` placement), `CopyToClipboard`, `ReloadExtension` (dev), install/update notifications, storage migration at 3.1.7. |
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
  - Both return `run(expr)`, which evaluates in the scripts' scope to reach top-level `let`/`class` bindings (`run('Rect')`, `run('Prefs = {...}')`). Globals owned by unloaded files (`ElemDocRects`, `LastModifierKeys`, `SvgOverlay`) are passed in `declare`.
- `test.Build.js` runs `gulp` and checks both manifests, referenced files, and byte-identical PNGs. It rewrites `build/`, so don't run it during `gulp watch`.
- Not covered: `EventHandler` (drag lifecycle), `SelectionRect` DOM, `SvgOverlay`, the options page. Verify manually with the fixtures in `test/` (`test_links.html`, `issue308.htm`, `iframe_*.htm`, `overlapped_range.html`) using `npx gulp watch` + `npm run run-ff`, or by loading `build/ff` / `build/chrome` unpacked.
- `test.failing` marks a known bug. Remove `.failing` when you fix it.
- For a bug fix, write the failing test first; for layout-dependent code add a fixture page to `test/`.

## Gotchas

- Runs in **every frame** of every page; be wary of anything heavy at load, and of global name collisions with page scripts (content scripts share an isolated world, but the extension's own files share one scope).
- Obscured-element detection samples only the rect midpoint; partly covered elements can be mis-classified (known idea in `DevNotes.md`).
- Gulp 5 pitfalls (both bit 3.1.16): `gulp.src` needs `{ encoding: false }` or it corrupts PNGs, and a positive glob listed after a `!negation` gets base `.` (options.html landed in `src/src/html/`). Keep positive globs first. `test.Build.js` guards both.
- Removed prefs aren't in `DefaultPrefs`, and `Prefs.<unknown>` throws. A migration must read them from `Prefs.Values` (see `MigratePrefs()`).
- `src/lib/Configs.js` and `ElementIndexer.IsVisible` are unused. Safe cleanups, but unrelated to most fixes.
- `artifacts/`, `build/`, `insecure/`, `local/` are gitignored. `dist/` holds old release files, not build output. Never commit secrets from `insecure/`.

## Where else to look

- `DevNotes.md`: open bugs, ideas, and deferred features.
- `CONTEXT-GRAPH.md`: recorded decisions and lessons (manifest, web-ext, ESLint/Babel upgrades).
- `docs/` (GitHub Pages site: `History.md`, `Tutorial.md`, `Contributing.md`, `Updated.md`): user-facing docs; update `History.md` for user-visible changes.
- Issues: <https://github.com/cpriest/SnapLinksPlus/issues>
