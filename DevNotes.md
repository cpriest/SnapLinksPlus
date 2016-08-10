# Bugs
 - [Issue #91](https://github.com/cpriest/SnapLinksPlus/issues/91)-1 - Width of selection box independent of zoom factor... possibly doable with SVG since it has it's own coordinate system??
 - Document size changes are not detected (on detection, need to clear DocElemRects)
 - Mutation Observer (clear DocElemRects, re-index if during drag)
 - Blank HREF's should be ignored

# Plans
 - ~~Add selection of and .click()ing of highlighted buttons~~
 - ~~Add "greatest of types" activation.  5 buttons & 1 link selected, only buttons will be .click()ed~~
 - Add Elements that have cursor: pointer (and have a click handler?)
 - ~~Add checking/un-checking of checkboxes~~
 - Add LABEL support (checkboxes, radio button, etc)
 - Add selection of "highest" radio button
 - Add size-of-text minification (select greatest size font links unless shift is held)
 - Add Options GUI
 - Better handling of label placement (separate from sizing rect)
