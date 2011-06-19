/*
 *  options.js
 *
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2008, 2009, 2011  Tommi Rautava
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

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
	getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.myext.");


function snaplInitializeOptions() {
	var checkboxes  = ["snaplinks.openmouseleave","snaplinks.shownumber","snaplinks.multiline","snaplinks.multifonts"];
	var groups = ["snaplinks.mouse","snaplinks.defaultaction","snaplinks.drawthick","snaplinks.linksthick"];
	var colors = ["snaplinks.drawpicker","snaplinks.linkspicker"];
	
	var checkbox, group, color, i;
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

	for (i = 0; i < checkboxes.length; i++) {
		checkbox = document.getElementById(checkboxes[i]);
		checkbox.checked = pref.getBoolPref(checkbox.getAttribute("prefstring"));
	}
	for (i = 0; i < groups.length; i++) {
		group = document.getElementById(groups[i]);
		group.selectedIndex = pref.getIntPref(group.getAttribute("prefstring"));
	}
	for (i = 0; i < colors.length; i++) {
		color = document.getElementById(colors[i]);
		color.color = pref.getCharPref(color.getAttribute("prefstring"));
	}

	snaplUpdateLineSamples(); 
}


function snaplSaveOptions(){
	var checkboxes  = ["snaplinks.openmouseleave","snaplinks.shownumber","snaplinks.multiline","snaplinks.multifonts"];
	var groups = ["snaplinks.mouse","snaplinks.defaultaction","snaplinks.drawthick","snaplinks.linksthick"];
	var colors = ["snaplinks.drawpicker","snaplinks.linkspicker"];
	  
	var checkbox, group, color, i;
	var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	for (i = 0; i < checkboxes.length; i++) {
		checkbox = document.getElementById(checkboxes[i]);
		pref.setBoolPref(checkbox.getAttribute("prefstring"), checkbox.checked);
	}
	for (i = 0; i < groups.length; i++) {
		group = document.getElementById(groups[i]);
		pref.setIntPref(group.getAttribute("prefstring"),group.selectedIndex);
	}
	for (i = 0; i < colors.length; i++) {
		color = document.getElementById(colors[i]);
		pref.setCharPref(color.getAttribute("prefstring"),color.color);
	}
	
	snaplUpdateOptions();
}

function snaplUpdateOptions(){
	try{
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		
		snaplButton = pref.getIntPref("extensions.snaplinks.button");
		snaplFineLinks = 1;
		snaplValueBold = pref.getBoolPref("extensions.snaplinks.multifonts")?1:0;
		snaplMultiWord = pref.getBoolPref("extensions.snaplinks.multiline")?1:0;
		snaplEndWhenOut = pref.getBoolPref("extensions.snaplinks.openmouseleave")?1:0;
		snaplShowNumber = pref.getBoolPref("extensions.snaplinks.shownumber")?1:0;
		
		snaplLinksBorderWidth = pref.getIntPref("extensions.snaplinks.linksthick");
		snaplBorderWidth = pref.getIntPref("extensions.snaplinks.drawthick");
	
		SNAPLACTION_DEFAULT = pref.getIntPref("extensions.snaplinks.defaultaction") + 1;
		snaplAction= SNAPLACTION_DEFAULT;	

		snaplBorderColor = pref.getCharPref("extensions.snaplinks.drawpicker");
		snaplLinksBorderColor = pref.getCharPref("extensions.snaplinks.linkspicker");
	}catch(e){}
}

function snaplUpdateLineSamples() {
	var color = document.getElementById("snaplinks.linkspicker").color;
	var size = document.getElementById("snaplinks.linksthick").selectedIndex;
	document.getElementById("snaplinks.linksId").setAttribute("style",
		"border-top-width:" + size + "px;border-top-color:" + color + ";border-top-style:solid");

	color = document.getElementById("snaplinks.drawpicker").color;
	size = document.getElementById("snaplinks.drawthick").selectedIndex;
	document.getElementById("snaplinks.drawId").setAttribute("style",
		"border-top-width:" + size + "px;border-top-color:" + color+";border-top-style:dashed");
}


