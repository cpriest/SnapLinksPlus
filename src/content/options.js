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

try {
	Components.utils.import('chrome://snaplinksplus/content/Utility.js');
}
catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}


var SnaplinksPrefsDialog = new (Class.create({
	InitializeDialog: function(dialog) {
		this.UpdateLinePreviews();

		var alwaysPrompt = document.getElementById("SnapLinks.Actions.Download.PromptForName");
		if (alwaysPrompt) {
			var pref = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
			var useDownloadDir = pref.getBoolPref("browser.download.useDownloadDir");

			if (useDownloadDir) {
				alwaysPrompt.removeAttribute('disabled');
			} else {
				alwaysPrompt.setAttribute('disabled', "true");
			}
		}
	},
	
	UpdateLinePreviews: function() {
		/* Initialize Selection Rect Preview */
		var SelectionBorderColor = document.getElementById('SnapLinks.Selection.BorderColor').color;
		var SelectionBorderSize = document.getElementById('SnapLinks.Selection.BorderWidth').selectedItem.value;
		var DrawPreviewElem = document.getElementById('SnapLinks.Selection.Preview');
		DrawPreviewElem.style.borderTopWidth = SelectionBorderSize +'px';
		DrawPreviewElem.style.borderTopColor = SelectionBorderColor;
		DrawPreviewElem.style.borderTopStyle = 'dashed';

		/* Initialize Links Preview */
		var SelectedBorderColor = document.getElementById('SnapLinks.SelectedElements.BorderColor').color;
		var SelectedBorderSize = document.getElementById('SnapLinks.SelectedElements.BorderWidth').selectedItem.value;
		var LinksPreviewElem = document.getElementById('SnapLinks.SelectedElements.Preview');
		LinksPreviewElem.style.borderTopWidth = SelectedBorderSize +'px';
		LinksPreviewElem.style.borderTopColor = SelectedBorderColor;
		LinksPreviewElem.style.borderTopStyle = 'solid';
	}

} ))();
