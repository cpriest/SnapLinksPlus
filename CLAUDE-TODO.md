# CLAUDE-TODO

Found while documenting the project (2026-09-30). None are urgent.

- [ ] `src/globals.js`: `isChrome` compares against `'chrome-extenson:'` (typo); never true.
- [ ] `src/background-scripts/background.js`: duplicated `case COPY_TO_CLIPBOARD`.
- [ ] `src/lib/Configs.js`: unreferenced; delete or confirm legacy.
- [ ] `src/content-scripts/ElementIndexer.js`: `IsVisible()` unused (its own comment calls it slow).
- [ ] `gulpfile.js` `webext()` and CI use `yarn`; local workflow is npm. Pick one.
- [ ] `.webext-ff.cjs` is Windows-specific (browser name, backslash path).
- [ ] No automated tests for lasso, indexing, or actions; consider jsdom-based tests for `CategorizedCollection` and `Rect`.
- [ ] `MigratePrefs()` (`src/globals.js`) is dead: the legacy key isn't in `DefaultPrefs`, so the read throws and is swallowed. Fix, then drop `.failing` in `tests/test.StoragePrefs.js`.
- [ ] Check whether the published 3.1.16 (built 2026-03-09 with gulp 5) shipped with corrupt icons and `src/src/html/options.html` (broken options page). Local artifact `artifacts/ff/snap_links-3.1.16.zip` has both. Fixed in `gulpfile.js`, uncommitted.
- [ ] Optional: add `jest-environment-jsdom` for `CategorizedCollection` / `ElementIndexer` tests; mock `browser.tabs` for `OpenUrlsInTabs` placement tests.
