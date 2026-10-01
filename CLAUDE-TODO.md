# CLAUDE-TODO

Found while documenting the project (2026-09-30). None are urgent.

- [ ] `src/lib/Configs.js`: unreferenced; delete or confirm legacy.
- [ ] `src/content-scripts/ElementIndexer.js`: `IsVisible()` unused (its own comment calls it slow).
- [ ] `gulpfile.js` `webext()` and CI use `yarn`; local workflow is npm. Pick one.
- [ ] `.webext-ff.cjs` is Windows-specific (browser name, backslash path).
- [ ] The local 3.1.16 artifact (gulp 5 build) has `src/src/html/options.html` (options page path wrong) and larger PNGs; icons displayed fine in Firefox, so only verify the options page in the installed 3.1.16. Build fixed in `gulpfile.js`.
- [ ] Untested: the options page (`src/lib/Options.js`, `options.html`).
