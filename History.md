
v3.1.5 / 2018-12-10
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
