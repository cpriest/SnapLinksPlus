# Before Next Release
 - **Bugs**
    - Since pub/sub:
        - document.execCommand(‘cut’/‘copy’) was denied because it was not called from inside a short running user-generated event handler.1ActionMgr.es6:40:3
- **Features**
    - Add size-of-text minification (select greatest size font links unless shift is held)
- **Test, issue?**
    - Clicking on js links from test document don't seem to work (possibly dev-mode related)

# Bugs
 - [Issue #91](https://github.com/cpriest/SnapLinksPlus/issues/91)-1 - Width of selection box independent of zoom factor... possibly doable with SVG since it has it's own coordinate system??
 - Mutation Observer (clear DocElemRects, re-index if during drag)
 - ~~Blank HREF's should be ignored~~
 - ~~Document size changes are not detected (on detection, need to clear DocElemRects)~~


# Plans
 - ~~Add selection of and .click()ing of highlighted buttons~~
 - ~~Add "greatest of types" activation.  5 buttons & 1 link selected, only buttons will be .click()ed~~
 - ~~Add checking/un-checking of checkboxes~~
 - ~~Add LABEL support (checkboxes, radio button, etc)~~
 - ~~Add selection of "highest" radio button~~
 - ~~Switch to using pub/sub model and de-couple the various parts~~
 - Add Options GUI
 - Better handling of label placement (separate from sizing rect)
 - Highlight "greatest of types" elements differently than elements which do not meet the greatest of.
    eg: 3 Buttons and 1 Anchor lassoed, the 3 Buttons would be highlighted in green vs the Anchor being highlighted in grey
 - ~~Move Inline Styles to Document \<STYLE> block~~


# Todo
 - Resolve all inspection errors
 - ~~JsDoc comments for everything~~
 - Externalize CSS Styles
 - ~~Separate all classes into their own files~~
 - Compiler/minimizer for production build?
 - docElem is a sandboxed global, replace document.documentElement references with docElem
 - Update phing (if js-csp/transducers.js work out)
    - js-csp
        - npm install
        - copy csp.min.js to src/lib
    - transducers.js
        - download/install (npm?)
        - copy transducers.js to src/lib

# Test
 - ~~Test using the new CSS3 all property to reset styles for our elements, such as setting all: initial on
   our SVG / SelectionRect DIV elements (may need to be contained by an element with style="all: inherit"
   This would replace the fix that was put in place for one website that had an overt transform selector set.~~

# Deferred / Possibly Won't Implement
 - Add Elements that have cursor: pointer (and have a click handler?)


<style>
    del { opacity: .5; }
    A { color: #36a3d9; text-decoration: underline; }
    BODY { background-color: black; }
    ARTICLE.markdown-body { padding: 35px !important; background-color: #1a1817 !important; }

/*  span { position: relative; }
    del::after {
        border-bottom: 1px solid rgba(255,255,255,.4);
        content: "";
        left: 0;
        position: absolute;
        right: 0;
        top: 50%;
    } */
</style>
