/*
 *  Copyright (C) 2011  Clint Priest
 *  
 *  This file is part of Snap Links.
 *
 *  Snap Links is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links.  If not, see <http://www.gnu.org/licenses/>.
 */
 

function LoadScript(path) {
	Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader)
		.loadSubScript(path);
}

LoadScript('chrome://snaplinks/content/Utility.js');

/* Includes some non-standard PrefsDialogMapper functionality like maintaining line previews */
var PrefsDialog = new (Class.create(PrefsDialogMapper, {
	InitializeDialog: function($super, dialog) {
		$super(dialog);
		this.UpdateLinePreviews();
	},
	
	UpdateLinePreviews: function() {
		/* Initialize Links Preview */
		var color = document.getElementById('snaplinks.linkspicker').color;
		var size = document.getElementById('snaplinks.linksthick').selectedIndex;
		document.getElementById('snaplinks.linksId').setAttribute('style',
			'border-top-width:' + size + 'px;border-top-color:' + color + ';border-top-style:solid');

		/* Initialize Selection Rect Preview */
		var color = document.getElementById('snaplinks.drawpicker').color;
		var size = document.getElementById('snaplinks.drawthick').selectedIndex;
		document.getElementById('snaplinks.drawId').setAttribute('style',
			'border-top-width:' + size + 'px;border-top-color:' + color+';border-top-style:dashed');
	},

} ))();
