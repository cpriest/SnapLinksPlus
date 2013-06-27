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


var SnapLinksPlus = { };

var Cu = Components.utils,
	Cc = Components.classes,
	Ci = Components.interfaces;

Cu.import('resource://gre/modules/Services.jsm');

try {
	Cu.import("chrome://snaplinksplus/content/snaplinks.js");
} catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

window.addEventListener('load', function() {
	SnapLinksPlus = new SnapLinksClass(window, document);

	try {
		Components.utils.import('chrome://snaplinksplus/content/Debug.js');
		SnapLinksPlus.Debug = new SnapLinksDebugClass();
	} catch(e) {
		 /* Ignored */
	}

	if(SnapLinksPlus.Prefs.DevShowJSConsoleAtStartup) {
		try {
			Cu.import("resource:///modules/HUDService.jsm", {}).HUDService.consoleUI.toggleBrowserConsole();
		} catch(e) { }
	}
}, false);

window.addEventListener('load', function() {
	if(Services.prefs.getPrefType('extensions.snaplinks.DevMode') && Services.prefs.getBoolPref('extensions.snaplinks.DevMode')) {
		function CreateAnonymousElement(markup) {
			var AnonymousElement = ((new DOMParser())
				.parseFromString('<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">' + markup + '</overlay>', 'text/xml')
				.firstChild
				.firstChild);
			AnonymousElement.parentNode.removeChild(AnonymousElement);
			return AnonymousElement;
		}

		SnapLinksPlus.RestartBrowser = function() {
			var iAppStartup = Components.interfaces.nsIAppStartup;
			Components.classes["@mozilla.org/toolkit/app-startup;1"]
				.getService(iAppStartup).quit(iAppStartup.eRestart | iAppStartup.eAttemptQuit);
		};

		/** Install pklib commands and keys */
		var CommandSet = document.querySelector('commandset');
		if(CommandSet) {
			var Command = CreateAnonymousElement('<command id="cmd.SnapLinksPlus.Commands.RestartBrowser" oncommand="SnapLinksPlus.RestartBrowser()" />');
			CommandSet.appendChild(Command);
		}

		var Keyset = document.querySelector('keyset');
		if(Keyset) {
			var Key = CreateAnonymousElement('<key id="key.SnapLinksPlus.Commands.RestartBrowser" modifiers="accel alt" key="R" command="cmd.SnapLinksPlus.Commands.RestartBrowser" />');
			Keyset.appendChild(Key);
		}
	}
}, false);
