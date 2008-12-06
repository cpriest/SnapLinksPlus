/*
 *  snaplinks.js 
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
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

var snaplStarted = false;
var snaplDrawing = false;

var snaplLinks;
var snaplVisibleLinks;
var snaplBoxes;
var snaplTSize;
				
var snaplTrailCont;

const snaplLMB  = 0;
const snaplMMB  = 1;
const snaplRMB  = 2;

var snaplButton;

var snaplBorderColor = '#30AF00';
var snaplLinksBorderColor = '#FF0000';

const snaplXhtmlNS = "http://www.w3.org/1999/xhtml";

var snaplRect;

var snaplX1=0;
var snaplX2=0;
var snaplY1=0;
var snaplY2=0;

var snaplVisible;
var snaplBorderWidth=3;
var snaplLinksBorderWidth=1;

var snaplTargetDoc;
var snaplStopPopup;
var snaplEqualSize;
var snaplIdTimeout=0;
var snaplLastMoveEvent;

var snaplLastEventMouseOver=0;
var snaplIdTimeoutStart=0;

var snaplPostLoadingActivate=false;

const SNAPLACTION_UNDEF=0;
const SNAPLACTION_TABS=1;
const SNAPLACTION_WINDOWS=2;
const SNAPLACTION_WINDOW=3;
const SNAPLACTION_CLIPBOARD=4;
const SNAPLACTION_BOOKMARK=5;
const SNAPLACTION_DOWNLOAD=6;
var SNAPLACTION_DEFAULT=SNAPLACTION_TABS;
var snaplAction=SNAPLACTION_DEFAULT;

var gsnaplinksBundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
var localeStrings = gsnaplinksBundle.createBundle("chrome://snaplinks/locale/snaplinks.properties");
var msgStatusUsage = localeStrings.GetStringFromName("snaplinks.status.usage");
var msgStatusLoading = localeStrings.GetStringFromName("snaplinks.status.loading");
var msgPanelLinks =  localeStrings.GetStringFromName("snaplinks.panel.links");

function updateStatus(str){
	var el = null;
	el = document.getElementById("snaplinks-panel");
	if (!el)
		return;	
	else
		el.label=str;

	if(str=="")
		el.hidden=true;
	else
		el.hidden=false;
}

function start(e){
	updateStatus("");
	snaplUpdateOptions();
	snaplContent = document.getElementById("content");

	var snaplRendering = snaplContent.mPanelContainer;
	snaplStarted = true;
	snaplContextPopup = document.getElementById("contentAreaContextMenu");
	snaplContextPopup.addEventListener("popupshowing", eventPopupshowing, false);
	snaplRendering.addEventListener("mouseup", eventMouseUp, true);
	snaplRendering.addEventListener("mousedown", eventMouseDown, true);
	snaplRendering.addEventListener("mouseout", eventMouseOut, true);
	snaplRendering.addEventListener("mousemove", eventMouseMove, true);
	snaplRendering.addEventListener("keypress", eventKeypress, true);
	
	snaplRendering.addEventListener("keydown", eventKeyDownUp, true);
	snaplRendering.addEventListener("keyup", eventKeyDownUp, true);
	
	document.addEventListener("scroll", eventOnScroll, false);
	document.addEventListener("mouseover", eventOnMouseOver, false);

	pop = document.getElementById("snaplMenu");
	pop.addEventListener("popuphidden",eventSnaplPopupHidden,false);
	
	snaplButton = snaplRMB;
	snaplLastEventMouseOver=0;
	snaplPostLoadingActivate=false;
	snaplAction=SNAPLACTION_DEFAULT;
}

function displayInfo(info){
	var statusbar = document.getElementById("statusbar-display");
	statusbar.label=info;
}

function eventKeypress(e){
	if(e.keyCode == KeyboardEvent.DOM_VK_ESCAPE){
		clearRect();
	}
}

function eventKeyDownUp(e){
	if(e.keyCode == KeyboardEvent.DOM_VK_SHIFT ){
		if(e.type.toLowerCase()=="keydown"){
			snaplEqualSize = false;
			drawRect();
		}
		if(e.type.toLowerCase()=="keyup"){
			snaplEqualSize = true;
			drawRect();
		}
	}
}

function eventOnMouseOver(e){
	saveMouseOverEvent(e);
}

function eventOnScroll(e){
	if(snaplLastEventMouseOver){
		scrollUpdate();
		eventMouseMove(snaplLastEventMouseOver);
		snaplLastEventMouseOver=0;
	}
}

function eventPopupshowing(e){
	if((snaplStopPopup==true) && (snaplButton==snaplRMB)){
		e.preventDefault();
		snaplStopPopup=false;
		return false;
	}
}

function eventMouseUp(e){
	if(e.button != snaplButton) return;
	if(snaplPostLoadingActivate) return;

	if(snaplVisible == true){
		snaplStopPopup=true;
		if(e.ctrlKey)
			showSnapPopup(e.clientX,e.clientY);
		
		if(!stillLoading()){
			activateLinks()
		}else{
			snaplPostLoadingActivate = true;
		}
	}
	else{
		clearRect();
		if(snaplButton == snaplRMB){
			var evt = document.createEvent("MouseEvents");
			snaplStopPopup=false;

			// This code didnt work well with the spell checking in FF 2.0
			//evt.initMouseEvent("contextmenu", true, true, e.originalTarget.defaultView, 0,
			//	e.screenX, e.screenY, e.clientX, e.clientY, false, false, false, false, 2, null);
			//	e.originalTarget.dispatchEvent(evt);

			evt.initMouseEvent("contextmenu", true, true, window, 0,
				e.screenX, e.screenY, e.clientX, e.clientY, false, false, false, false, 2, null);
				//e.originalTarget.dispatchEvent(evt);

			var item = gContextMenu.target;
			item.dispatchEvent(evt);

		  	//document.popupNode = e.originalTarget;
			//var obj = document.getElementById("contentAreaContextMenu");
			//obj.showPopup(this, e.clientX, e.clientY, "context", null, null);
			  
			snaplStopPopup=true;
		}
	}
}

function showSnapPopup(x,y){
	pop = document.getElementById("snaplMenu");
	pop.showPopup(pop,x,y,"popup",0,0);
	snaplAction=SNAPLACTION_UNDEF;
}

function activateLinks(){
	if(snaplAction != SNAPLACTION_UNDEF){
		drawRect();
		executeAction();
		clearRect();
	}
}

function signalEndLoading(){
	if(snaplPostLoadingActivate){
		snaplPostLoadingActivate=false;
		activateLinks();
	}
}

function eventMouseOut(e){

	if(snaplEndWhenOut){
		if(snaplVisible == true){
			if(!e.relatedTarget){
				snaplStopPopup=true;
				drawRect();
				executeAction();
				clearRect();
			}
		}
	}
}

function eventMouseDown(e){
	snaplUpdateOptions();

	if(e.button != snaplButton) return;
	if(snaplPostLoadingActivate) return;

	snaplStopPopup = true;

	initiateLoading();
	initializeLoc(e);
	snaplEqualSize=true;
	snaplDrawing=true;
}


function saveMouseOverEvent(e){
	if(!snaplLastEventMouseOver)
		snaplLastEventMouseOver = new Object();

	snaplLastEventMouseOver.pageX = e.pageX;
	snaplLastEventMouseOver.pageY = e.pageY;
}

function saveMouseEvent(e){
	if(!snaplLastMoveEvent)
		snaplLastMoveEvent = new Object();

	snaplLastMoveEvent.pageX = e.pageX;
	snaplLastMoveEvent.pageY = e.pageY;
}

function eventMouseMove(e){
	if(snaplDrawing==false) return;
	if(snaplPostLoadingActivate || !snaplAction) return;

	updateStatusLabel();

	selectZone(e);

	if(!snaplIdTimeout){
		snaplIdTimeout=window.setTimeout("processTimeout();",300);
	}
}

function processTimeout(){
	snaplIdTimeout=0;
	drawRect()
}

function updateStatusLabel(){
	if(!snaplDrawing)
		return;

	if(stillLoading())
		displayInfo(msgStatusLoading);	
	else
		displayInfo(msgStatusUsage);	
}


function snaplActionNewTabs(){
	snaplAction=SNAPLACTION_TABS;
}

function snaplActionNewWindows(){
	snaplAction=SNAPLACTION_WINDOWS;
}

function snaplActionClipboard(){
	snaplAction=SNAPLACTION_CLIPBOARD;
}

function snaplActionTabsInNewWindow(){
	snaplAction=SNAPLACTION_WINDOW;
}

function snaplActionBookmark(){
	snaplAction=SNAPLACTION_BOOKMARK;
}

function snaplActionDownload(){
	snaplAction=SNAPLACTION_DOWNLOAD;
}

function eventSnaplPopupHidden(){

	if(snaplAction == SNAPLACTION_UNDEF){
		snaplAction = SNAPLACTION_DEFAULT;
		// Escape
		clearRect();
		return;
	}
	activateLinks()
	snaplAction = SNAPLACTION_DEFAULT;
}


window.addEventListener("load", start, false);
