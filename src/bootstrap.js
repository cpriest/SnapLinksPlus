/*
 *  bootstrap.js
 *
 *  Copyright (C) 2011, 2012  Clint Priest, Tommi Rautava
 *
 *  This file is part of Snap Links Plus.
 *
 *  Snap Links Plus is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links Plus is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links Plus.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/**
 * @TODO:
 *
 */


var SnapLinksPlus = { };
var AddonData = { };
var gBootMgr;

let { Constructor: CC, classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import('resource://gre/modules/Services.jsm');

function LoadIntoWindow(window) {
	if(Services.prefs.getPrefType('extensions.snaplinks.Dev.Mode') && Services.prefs.getBoolPref('extensions.snaplinks.Dev.Mode')) {

		gBootMgr.OverlayDocumentOnto('chrome://snaplinksplus/content/Dev/DevMode.xul', window.document);

		if(Services.prefs.getPrefType('extensions.snaplinks.Dev.ShowConsoleAtStartup') && Services.prefs.getBoolPref('extensions.snaplinks.Dev.ShowConsoleAtStartup')) {
			if(!window.HUDService.getBrowserConsole())
				window.HUDService.toggleBrowserConsole();
		}

		//SnapLinksPlus.RestartBrowser = function() {
		//	var iAppStartup = Components.interfaces.nsIAppStartup;
		//	Components.classes["@mozilla.org/toolkit/app-startup;1"]
		//		.getService(iAppStartup).quit(iAppStartup.eRestart | iAppStartup.eAttemptQuit);
		//};

	}

	try {
		window.SnapLinksPlus = {
			Reload: function Reload() {
				Cu.import("resource://gre/modules/AddonManager.jsm");
				AddonManager.getAddonByID(AddonData.id, function (ext) {
					ext.userDisabled = true;
					Services.obs.notifyObservers(null, "startupcache-invalidate", null); // Does chrome-flush-caches cover this?
					Services.obs.notifyObservers(null, "chrome-flush-caches", null);
					ext.userDisabled = false;
					console.clear();
				});
			}
		};
//		window.SnapLinksPlus = new SnapLinksClass(window, window.document);

//		window.SnapLinksPlus.Debug = new SnapLinksDebugClass();
	} catch(e) {
		 /* Ignored */
		console.error(e);
	}
}

function UnloadFromWindow(window) {
	gBootMgr.RemoveOverlayNodes(window.document);
//	window.SnapLinksPlus.unload();
//	delete window.SnapLinksPlus;
}


// Apply a function to all open browser windows
function ForEachOpenWindow(todo) {
	let windows = Services.wm.getEnumerator("navigator:browser");
	while (windows.hasMoreElements()) {
		try {
			todo(windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow));
		} catch(e) {
			console.error(e);
		}
	}
}

var WindowListener = {
	onOpenWindow: function (xulWindow) {
		var window = xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindow);

		function onWindowLoad() {
			window.removeEventListener("load", onWindowLoad);
			if (window.document.documentElement.getAttribute("windowtype") == "navigator:browser")
				LoadIntoWindow(window);
		}

		window.addEventListener("load", onWindowLoad);
	},
	onCloseWindow      : function (xulWindow) {
	},
	onWindowTitleChange: function (xulWindow, newTitle) {
	}
};

function startup(data,reason) {
	console.log('startup(x): data: %o, reason: %d', data, reason);

	AddonData = data;

	let db = Services.prefs.getDefaultBranch(null);

	db.setCharPref('extensions.snaplinks@snaplinks.mozdev.org.description', 'chrome://snaplinksplus/locale/snaplinks.properties');

	try {
		Cu.import("chrome://snaplinksplus/content/Utility.js");

		Unloader.load("chrome://snaplinksplus/content/snaplinks.js");
		Unloader.load('chrome://snaplinksplus/content/Debug.js');
		Unloader.load("chrome://snaplinksplus/content/Utility.js");		/*| Just present so Unloader knows to unload its-self */

		 gBootMgr = new BootstrapMgr();

		ForEachOpenWindow(LoadIntoWindow);
	} catch(e) {
		console.error(e);
	}
	console.log('~startup');
	Services.wm.addListener(WindowListener);
}

function shutdown(data,reason) {
	console.log('shutdown(): data: %o, reason: %d', data, reason, reason == APP_SHUTDOWN);
	if (reason == APP_SHUTDOWN)
		return;

	ForEachOpenWindow(UnloadFromWindow);
	Services.wm.removeListener(WindowListener);

	Unloader.unload();

	// HACK WARNING: The Addon Manager does not properly clear all addon related caches on update;
	//               in order to fully update images and locales, their caches need clearing here
	Services.obs.notifyObservers(null, "startupcache-invalidate", null); // Does chrome-flush-caches cover this?
	Services.obs.notifyObservers(null, "chrome-flush-caches", null);

//	Cu.import("resource://gre/modules/AddonManager.jsm");
//
//	AddonManager.getAddonByID(data.id, function (ext) {
//		console.log('got here 2');
//		ext.userDisabled = true;
//		ext.userDisabled = false;
//	});
	console.log('~shutdown()');
}

function install(data,reason) {
	console.log('install(): data: %o, reason: %d', data, reason);
}

function uninstall(data,reason) {
	console.log('uninstall(): data: %o, reason: %d', data, reason);
}

//window.addEventListener('load', function() {
//
//	if(Services.prefs.getPrefType('extensions.snaplinks.Dev.Mode') && Services.prefs.getBoolPref('extensions.snaplinks.Dev.Mode')) {
//		function CreateAnonymousElement(markup) {
//			var AnonymousElement = ((new DOMParser())
//				.parseFromString('<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">' + markup + '</overlay>', 'text/xml')
//				.firstChild
//				.firstChild);
//			AnonymousElement.parentNode.removeChild(AnonymousElement);
//			return AnonymousElement;
//		}
//
//		SnapLinksPlus.RestartBrowser = function() {
//			var iAppStartup = Components.interfaces.nsIAppStartup;
//			Components.classes["@mozilla.org/toolkit/app-startup;1"]
//				.getService(iAppStartup).quit(iAppStartup.eRestart | iAppStartup.eAttemptQuit);
//		};
//
//		/** Install pklib commands and keys */
//		var CommandSet = document.querySelector('commandset');
//		if(CommandSet) {
//			var Command = CreateAnonymousElement('<command id="cmd.SnapLinksPlus.Commands.RestartBrowser" oncommand="SnapLinksPlus.RestartBrowser()" />');
//			CommandSet.appendChild(Command);
//		}
//
//		var Keyset = document.querySelector('keyset');
//		if(Keyset) {
//			var Key = CreateAnonymousElement('<key id="key.SnapLinksPlus.Commands.RestartBrowser" modifiers="accel alt" key="R" command="cmd.SnapLinksPlus.Commands.RestartBrowser" />');
//			Keyset.appendChild(Key);
//		}
//	}
//}, false);
