# CLAUDE-TODO

Found while documenting the project (2026-09-30). None are urgent.

- [ ] `src/globals.js`: `isChrome` compares against `'chrome-extenson:'` (typo); never true.
- [ ] `src/background-scripts/background.js`: duplicated `case COPY_TO_CLIPBOARD`.
- [ ] `src/lib/Configs.js`: unreferenced; delete or confirm legacy.
- [ ] `src/content-scripts/ElementIndexer.js`: `IsVisible()` unused (its own comment calls it slow).
- [ ] `gulpfile.js` `webext()` and CI use `yarn`; local workflow is npm. Pick one.
- [ ] `.webext-ff.cjs` is Windows-specific (browser name, backslash path).
- [ ] No automated tests for lasso, indexing, or actions; consider jsdom-based tests for `CategorizedCollection` and `Rect`.
