/*
 *  options.js
 *
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
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
 */

function LoadScript(path) {
	Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader)
		.loadSubScript(path);
}

LoadScript('chrome://snaplinksplus/content/Utility.js');

var SnaplinksPrefsDialog = new (Class.create({
	_dialog: null,
	
	InitializeDialog: function(dialog) {
		this._dialog = dialog;
		this.UpdateLinePreviews();

		var alwaysPrompt = document.getElementById("snaplinks.checkbox.AlwaysPromptDownloadName");
		if (alwaysPrompt) {
			var pref = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
			var useDownloadDir = pref.getBoolPref("browser.download.useDownloadDir");

			if (useDownloadDir) {
				alwaysPrompt.removeAttribute('disabled');
			}
			else {
				alwaysPrompt.setAttribute('disabled', true);
			}
		}
	},
	
	UpdateLinePreviews: function() {
		/* Initialize Selection Rect Preview */
		var color = document.getElementById('snaplinks.drawpicker').color;
		var size = document.getElementById('snaplinks.drawthick').selectedItem.value;
		var drawPreviewElem = document.getElementById('snaplinks.drawId');
		drawPreviewElem.style.borderTopWidth = size +'px';
		drawPreviewElem.style.borderTopColor = color;
		drawPreviewElem.style.borderTopStyle = 'dashed';

		/* Initialize Links Preview */
		var color = document.getElementById('snaplinks.linkspicker').color;
		var size = document.getElementById('snaplinks.linksthick').selectedItem.value;
		var linksPreviewElem = document.getElementById('snaplinks.linksId');
		linksPreviewElem.style.borderTopWidth = size +'px';
		linksPreviewElem.style.borderTopColor = color;
		linksPreviewElem.style.borderTopStyle = 'solid';
	}

} ))();
