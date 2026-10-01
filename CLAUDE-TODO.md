# CLAUDE-TODO

Found while documenting the project (2026-09-30). None are urgent.

- [ ] `src/globals.js`: `isChrome` compares against `'chrome-extenson:'` (typo); never true.
- [ ] `src/background-scripts/background.js`: duplicated `case COPY_TO_CLIPBOARD`.
- [ ] `src/lib/Configs.js`: unreferenced; delete or confirm legacy.
- [ ] `src/content-scripts/ElementIndexer.js`: `IsVisible()` unused (its own comment calls it slow).
- [ ] `gulpfile.js` `webext()` and CI use `yarn`; local workflow is npm. Pick one.
- [ ] `.webext-ff.cjs` is Windows-specific (browser name, backslash path).
- [ ] The local 3.1.16 artifact (gulp 5 build) has `src/src/html/options.html` (options page path wrong) and larger PNGs; icons displayed fine in Firefox, so only verify the options page in the installed 3.1.16. Build fixed in `gulpfile.js`.
- [ ] `CategorizedCollection.FilterByFontScore`: sorts score keys as strings, so a font under 10px outranks larger fonts. Numeric sort, then drop `.failing` in `tests/test.CategorizedCollection.js`.
- [ ] `RectMapper.GetFontScore`: `replace(/\D+/g, '')` drops the decimal point (`12.5px` → 12500). Use `parseFloat`, then drop `.failing` in `tests/test.ElementIndexer.js`.
- [ ] `RectMapper.GetElementRects`: `querySelectorAll('IMG, SVG')` likely never matches inline `<svg>` (non-HTML elements match type selectors case-sensitively). Verify in Firefox; use lowercase `svg`.
- [ ] `background.js` `CheckInstallation`: on a fresh install `item.LastInstalledVersion.localeCompare` throws (undefined), caught and logged as an error after the notification is shown.
- [ ] Untested: `EventHandler` drag lifecycle, `SelectionRect` DOM, `SvgOverlay`, options page.
