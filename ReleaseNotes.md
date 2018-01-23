v3.1.2 - Not Yet Released
=========================
 - Added ability to control which modifier keys and which mouse button is used for activation
 - Fixed issues with chrome
 - Fixed an issue with radio button selection
 - Fixed an issue with checkboxes
 - Added support for Containers
 - Added support for Child/Parent tabs (Tab Tree View)

v3.1.1.3 - Released Dec 16, 2016
================================
 - Proper culling of obscured elements (hidden behind overlays...)
    - Ensure performance is good


v3.1.0.4 - Released Nov 15th, 2016
===================================
 - Pressing escape will now cancel an already started drag operation
 - Fixed #97 - Context Menu no longer worked after dragging once.
 - Fixed #91.1 (Related) - Page resize/zooming now properly re-adjusts rects
 - Fixed #91.2 - transition CSS from page no longer affects selection rect
 - "Greatest of Type" is now used when multiple types are lassoed (Links vs Buttons, etc)
 - Can now lasso buttons which causes them to be clicked
 - Can now lasso checkboxes (checks all or un-checks all)
   (depending on opposite majority, prefers checking when equal)
 - Can now lasso labels for checkboxes and radio boxes
 - Can now lasso radio buttons, selects the first radio of each group
 - Document Size Changes are now detected properly
 - "Greatest Size of Text" is now used for Links / Javascript Links
   - This can be bypassed by holding down alt while dragging
 - New tabs will open to the right of the current tab
 - New tabs will be opened in document element order
 - The first tab by document order opened will also become active
 - Added website and new welcome page with introduction on how to use SnapLinks v3
 - Contributions from AstrodogX
     - Now skipping elements that are not visible
     - Copy Links To Clipboard by Holding down ctrl while releasing the selection
     - Count of selected elements appears
 - Contributions from Phyxion
     - Tireless testing on a wide variety of websites, **thank you!**

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
