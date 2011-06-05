/*
 *  snaplinks.js 
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2009  Tommi Rautava
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
 * 
 * Activity:
 * 	 Clint Priest - 6/3/2011 - Fairly complete refactor and major rewrite
 */
 
 /*
 *	To Fix:
 * 		Scrolling while selection active does not update selection rect properly (look into using clientX + scrollX rather than pageX)
 *
 *
 *
 */
 
var snaplDrawing = false;

const snaplLMB  = 0;
const snaplMMB  = 1;
const snaplRMB  = 2;

var snaplButton;

var snaplBorderColor = '#30AF00';
var snaplLinksBorderColor = '#FF0000';

var snaplBorderWidth=3;
var snaplLinksBorderWidth=1;

var snaplTargetDoc;
var snaplStopPopup;

const SNAPLACTION_UNDEF=0;
const SNAPLACTION_TABS=1;
const SNAPLACTION_WINDOWS=2;
const SNAPLACTION_WINDOW=3;
const SNAPLACTION_CLIPBOARD=4;
const SNAPLACTION_BOOKMARK=5;
const SNAPLACTION_DOWNLOAD=6;
var SNAPLACTION_DEFAULT=SNAPLACTION_TABS;

var gsnaplinksBundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
var localeStrings = gsnaplinksBundle.createBundle("chrome://snaplinks/locale/snaplinks.properties");
var msgStatusUsage = localeStrings.GetStringFromName("snaplinks.status.usage");
var msgStatusLoading = localeStrings.GetStringFromName("snaplinks.status.loading");
var msgPanelLinks =  localeStrings.GetStringFromName("snaplinks.panel.links");

var SnapLinksContext = { };

window.addEventListener('load', function() {
	function LoadScript(path) {
		Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Components.interfaces.mozIJSSubScriptLoader)
			.loadSubScript(path, SnapLinksContext);
	}
	
	LoadScript('chrome://snaplinks/content/Utility.js');
	LoadScript('chrome://snaplinks/content/Selection.js');
	LoadScript('chrome://snaplinks/content/Debug.js');
	LoadScript('chrome://snaplinks/content/SnapLinks.js');
}, false);

