'use strict';

/* global importScripts */

/*
 * The Chrome build's background: a service worker (Manifest V3), which loads one script.  It loads the same scripts, in
 * the same order, as Firefox's background (see manifest.hbs).  Paths are relative to this file.
 *
 * Like Firefox's event page, Chrome stops the worker when idle and starts it again for the next event, see the top of
 * background.js.  A worker has no DOM and no clipboard: globals.js loads Prefs at once, and copying goes through an
 * offscreen document (WriteToClipboard() in background.js).
 */
importScripts('../lib/browser-polyfill.js', '../StoragePrefs.js', '../globals.js');

// `gulp watch` (DevBuild) adds DevBuild.js and the dev-do-* commands to the build
if(chrome.runtime.getManifest().commands?.['dev-do-1'])
	importScripts('DevBuild.js');

importScripts('background.js');
