# CLAUDE-TODO

Found while documenting the project (2026-09-30). None are urgent.

- [ ] `src/lib/Configs.js`: unreferenced; delete or confirm legacy.
- [ ] `src/content-scripts/ElementIndexer.js`: `IsVisible()` unused (its own comment calls it slow).
- [ ] `gulpfile.js` `webext()` and CI use `yarn`; local workflow is npm. Pick one.
- [ ] `.webext-ff.cjs` is Windows-specific (browser name, backslash path).
