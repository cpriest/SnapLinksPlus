
v3.1.5 - 2018-12-10
===================
  * Updates for v3.1.5 release
  * Added a global Function.wrap() method and wrapped console.(log|info|warn|error) which returns the first argument after logging - For inline logging of a value * Updated gulpfile.js to v4 - ugh, but cool.
  * Eliminated a few Copyright headers and put into LICENSE file * Added LICENSE file to packaged plugin via gulp * Converter a portion of Config.js to async/await
  * A few more bugfixes   * Removed unused transducers.js   * Fixed some errors that showed up related to the quick-release fix for Dev_Mode
  * Bugfixes for CSP.js to work in node/require and as web-extension.
  * Added jest tests for js-csp package at 0.7, to ensure upgrade works correctly.
  * Updated .idea files
  * Updates to website
  * Updates to build system for publishing to Chrome, yarn lock file, Merged Screenshot for Chrome Web Store.

v3.1.4 - 2018-11-05
===================
 - Fixed a coloring issue of the label on some websites

v3.1.3 - 2018-09-12
===================
 - Added ability to open new tabs always at the end of tab bar

v3.1.2b1 - 2018-03-06
=====================
 - Added ability to control which modifier keys and which mouse button is used for activation
 - Fixed issues with scrolling/selection in scrolled sub-frames
 - Fixed issues with chrome
 - Fixed an issue with radio button selection
 - Fixed an issue with checkboxes
 - Added support for FireFox Containers
 - Added support for Child/Parent tabs (Tab Tree View)
 - Updated Options/Config to include expanded functionality

v3.1.1.3 - 2016-12-16
=====================
 - Proper culling of obscured elements (hidden behind overlays...)
 - Ensure performance is good

v3.1.0.4 - 2016-11-15
=====================
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
