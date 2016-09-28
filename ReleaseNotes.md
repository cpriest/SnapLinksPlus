v3.0.3 - Not Yet Released
=========================
 - Pressing escape will now cancel an already started drag operation
 - Fixed #97 - Context Menu no longer worked after dragging once.
 - Fixed #91.1 (Related) - Page resize/zooming now properly re-adjusts rects
 - Fixed #91.2 - transition CSS from page no longer affects selection rect
 - Contributions from AstrodogX
     - Now skipping elements that are not visible
     - Copy Links To Clipboard by Holding down ctrl while releasing the selection
     - Count of selected elements appears
 - "Greatest of Type" is now used when multiple types are lassoed (Links vs Buttons, etc)
 - Can now lasso buttons which causes them to be clicked
 - Can now lasso checkboxes (checks all or un-checks all)
   (depending on opposite majority, prefers checking when equal)
 - Can now lasso labels for checkboxes and radio boxes
 - Can now lasso radio buttons, selects the first radio of each group
 - Document Size Changes are now detected properly

v3.0.0b2
========
 - Mostly a build system setup, compatibility with Chrome & submission
   to AMO/Chrome Mostly a build system setup, compatibility with Chrome
   & submission to AMO/Chrome

v3.0b1
======
 - Initial beta version 1 of 3.0 - Tracer bullet to the target
 - Supports a single complete use-case which is right-click-drag
   to select any A\[href] links and open them in tabs
 - Auto-scrolling of drag rect
 - Should be compatible with chrome

v3.0a1
======
 - Initial purging of old XUL/XPCOM files
