// Snap Links 0.0.4
// 09-Sep-2007
// Pedro Fonseca (savred at gmail)
// Licence: GPL
// ----------------------------------------------------------------

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

	var color = document.getElementById("snaplinks.drawpicker").color;
	var size = document.getElementById("snaplinks.drawthick").selectedIndex;
	document.getElementById("snaplinks.drawId").setAttribute("style",
		"border-top-width:" + size + "px;border-top-color:" + color+";border-top-style:dashed");
}


