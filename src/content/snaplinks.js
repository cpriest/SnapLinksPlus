/*
 *  snaplinks.js 
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2009  Tommi Rautava
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

var snaplMultiBoxesMode = 0;
var snaplMultiBoxes;

var snaplTrailCont;

const snaplLMB  = 0;
const snaplMMB  = 1;
const snaplRMB  = 2;

var snaplButton;

var snaplBorderColor = '#30AF00';
var snaplLinksBorderColor = '#FF0000';

const snaplXhtmlNS = "http://www.w3.org/1999/xhtml";

var snaplVisible;
var snaplBorderWidth=3;
var snaplLinksBorderWidth=1;

var snaplTargetDoc;
var snaplStopPopup;
var snaplEqualSize;
var snaplIdTimeout=0;

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


/**
*  Heavy Refactoring of code base by Clint Priest on 5/22/2011
*/
var SnapLinks;

/* Utility */
function Log() { Firebug.Console.logFormatted(arguments); }

/** Stripped down (non inheriting version of prototype classes, allows for getters/setters including c# style getters/setters */
var Class = (function() {
	function create() {
		function klass() {
			this.initialize.apply(this, arguments);
		}
		
		klass.addMethods = Class.Methods.addMethods;
		
		for (var i = 0; i < arguments.length; i++)
			klass.addMethods(arguments[i]);

		if (!klass.prototype.initialize)
			klass.prototype.initialize = function() { };

		return klass;
	}

	function addMethods(source) {
		var properties = Object.keys(source);

		for (var i = 0, length = properties.length; i < length; i++) {
			var property = properties[i];
			
			var Setter = source.__lookupSetter__(property),
				Getter = source.__lookupGetter__(property);

			if(Setter)
				this.prototype.__defineSetter__(property, Setter);
			if(Getter)
				this.prototype.__defineGetter__(property, Getter);

			if(Setter == undefined && Getter == undefined) {

				/* Support Name: { get: function(), set: function() } syntax, ala C# getter/setter syntax */
				var Descriptor = source[property];
				if(Descriptor && typeof Descriptor == 'object' && (Descriptor.get || Descriptor.set)) {
					if(Descriptor.set)
						this.prototype.__defineSetter__(property, Descriptor.set);
					if(Descriptor.get)
						this.prototype.__defineGetter__(property, Descriptor.get);
				} else {
					this.prototype[property] = source[property];
				}
			}
		}
		return this;
	}

	return {
		create: create,
		Methods: {
			addMethods: addMethods
		}
	};
})();

window.addEventListener('load', function() {
	
	
	/** Selection class handles the selection rectangle and accompanying visible element */
	var Selection = Class.create({ 
		X1: 0, Y1: 0, X2: 0, Y2: 0,
		
		NormalizedRect: {
			get: function() { 
				return {	X1: Math.min(this.X1,this.X2),	Y1: Math.min(this.Y1,this.Y2),
							X2: Math.max(this.X1,this.X2),	Y2: Math.max(this.Y1,this.Y2),	}
			},
		},
		
		DragStarted: false,
		
		initialize: function(PanelContainer) {
			this.PanelContainer = PanelContainer;
			this.PanelContainer.addEventListener("mousedown", this.OnMouseDown.bind(this), true);
			this.PanelContainer.addEventListener("mouseup", this.OnMouseUp.bind(this), true);

			this._OnMouseMove 	= this.OnMouseMove.bind(this);
//			this._OnMouseOut	= this.OnMouseOut.bind(this);
		},
		
		OnMouseDown: function(e) {
			if(e.button != snaplButton)
				return;

			if(snaplPostLoadingActivate)
				return;

			this.Document = e.target.ownerDocument;
				
			/** Initializes the starting mouse position */
			this.X1 = Math.min(e.pageX,this.Document.documentElement.offsetWidth + this.Document.defaultView.pageXOffset);
			this.Y1 = e.pageY;

			this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
		},
		
		OnMouseMove: function(e) {
			if(snaplDrawing == false || snaplPostLoadingActivate == true || !snaplAction)
				return;
			
			if(e.altKey) {
				this.OffsetSelection(e.pageX - this.X2, e.pageY - this.Y2);

				/** The below commented section of code causes the rectangle to shrink if it goes off screen, is this even a desired functionality? -- Clint - 5/22/2011 */
		//		var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		//			.getInterface(Components.interfaces.nsIWebNavigation)
		//			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
		//			.rootTreeItem
		//			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		//			.getInterface(Components.interfaces.nsIDOMWindow);
		//		var tabbrowser = mainWindow.document.getElementById("content");
		//		var minHeight = tabbrowser.selectedBrowser.boxObject.height;
		//		var minWidth = tabbrowser.selectedBrowser.boxObject.width;
																														
		//		SnapLinks.Selection.X1 = Math.max(Math.min(Math.max(snaplTargetDoc.width,minWidth),SnapLinks.Selection.X1),0);
		//		SnapLinks.Selection.Y1 = Math.max(Math.min(Math.max(snaplTargetDoc.height,minHeight),SnapLinks.Selection.Y1),0);
			} else {
				this.ExpandSelectionTo(Math.min(e.pageX,this.Document.documentElement.offsetWidth + this.Document.defaultView.pageXOffset), e.pageY);
			}
		},

		OnMouseUp: function(e) {
			this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
		},
		
		
		Create: function() {
			if(this.DragStarted == true)
				return true;
				
			if(!snaplIdTimeoutStart && Math.abs(this.X1-this.X2) > 4 || Math.abs(this.Y1-this.Y2) > 4) {
				var InsertionNode = (this.Document.documentElement) ? this.Document.documentElement : this.Document;
				
				this.Element = this.Document.createElementNS(snaplXhtmlNS, 'snaplRect');
				if(InsertionNode && this.Element) {
					this.Element.style.color = snaplBorderColor;
					this.Element.style.border = snaplBorderWidth + 'px dotted';
					this.Element.style.position = 'absolute';
					this.Element.style.zIndex = '10000';
					this.Element.style.left = this.X1 + 'px'; 
					this.Element.style.top = this.Y1 + 'px';
					InsertionNode.appendChild(this.Element);

					this.DragStarted = this.Element.parentNode != undefined;

					if(this.DragStarted) {
						snaplIdTimeoutStart=window.setTimeout("processTimeoutStartRect();",50);

						snaplVisible=true;
						if(snaplShowNumber)
							updateStatus(msgPanelLinks + " " + "0");
						return true;
					}
				}
			}
			return false;
		},

		/** Clears the selection by removing the element, also clears some other non-refactored but moved code */
		Clear: function() {
			if (this.Element)
				this.Element.parentNode.removeChild(this.Element);
			this.Element = null;
			
			this.X1=0; this.X2=0; this.Y1=0; this.Y2=0;
			this.DragStarted = false;
		},
		
		/** Offsets the selection by the given coordinates */
		OffsetSelection: function(X, Y) {
			this.X1 += X;	this.Y1 += Y;
			this.X2 += X;	this.Y2 += Y;
			this.UpdateElement();
		},
		
		ExpandSelectionTo: function(X, Y) {
			this.X2 = X;	this.Y2 = Y;
			this.UpdateElement();
		},
		
		UpdateElement: function() {
			if(this.Create()) {
				this.Element.style.width 	= Math.abs(this.X1-this.X2) - snaplBorderWidth + 'px';
				this.Element.style.height 	= Math.abs(this.Y1-this.Y2) - snaplBorderWidth + 'px';
				this.Element.style.top 		= Math.min(this.Y1,this.Y2) - snaplBorderWidth + 'px';
				this.Element.style.left 	= Math.min(this.X1,this.X2) - snaplBorderWidth + 'px';
			}
		},
	} );
	
	SnapLinks = new (Class.create( {
		
		StatusBarLabel: {	set: function(x) { document.getElementById('statusbar-display').label = x; }	},
		
		initialize: function() {
			this.PanelContainer = document.getElementById("content").mPanelContainer;
			this.PanelContainer.addEventListener("mousedown", this.OnMouseDown.bind(this), true);
			this.PanelContainer.addEventListener("mouseup", this.OnMouseUp.bind(this), true);
			
			this._OnMouseMove 	= this.OnMouseMove.bind(this);
			this._OnMouseOut	= this.OnMouseOut.bind(this);

			this.Selection = new Selection(this.PanelContainer);
		},
		
		UpdateStatusLabel: function() {
			if(!snaplDrawing)
				return;

			if(stillLoading())
				this.StatusBarLabel = msgStatusLoading;
			else
				this.StatusBarLabel = msgStatusUsage;
		},
		
		OnMouseDown: function(e) {
			snaplUpdateOptions();

			if(e.button != snaplButton)
				return;
			if(snaplPostLoadingActivate)
				return;

			snaplStopPopup = true;

			initiateLoading();
			
			snaplTargetDoc = e.target.ownerDocument;

			/** Does this even do anything?? --Clint */
//			if (snaplTargetDoc.defaultView.top instanceof Window){
//				snaplTargetDoc = snaplTargetDoc;
//			}

			this.Clear();
						
			snaplVisible=false;			
			snaplEqualSize=true;
			snaplDrawing=true;

			this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
			this.PanelContainer.addEventListener('mouseout', this._OnMouseOut, true);
		},
		
		OnMouseMove: function(e) {
			if(snaplDrawing == false || snaplPostLoadingActivate == true || !snaplAction)
				return;

			this.UpdateStatusLabel();
			
			snaplEqualSize = e.shiftKey;
			
			if(!snaplIdTimeout)
				snaplIdTimeout=window.setTimeout("processTimeout();",300);
		},
		
		OnMouseUp: function(e) {
			if(e.button != snaplButton)
				return;
			if(snaplPostLoadingActivate)
				return;

			this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
			this.PanelContainer.removeEventListener('mouseout', this._OnMouseOut, true);

			if(snaplVisible == true){
				snaplStopPopup=true;
				if(e.ctrlKey) {
					showSnapPopup(e);
				}
				
				if(!stillLoading()){
					activateLinks();
				}else{
					snaplPostLoadingActivate = true;
				}
			} else {
				SnapLinks.Clear();
				if(snaplButton == snaplRMB){
					var evt = document.createEvent("MouseEvents");
					snaplStopPopup=false;

					// This code didnt work well with the spell checking in FF 2.0
					//evt.initMouseEvent("contextmenu", true, true, e.originalTarget.defaultView, 0,
					//	e.screenX, e.screenY, e.clientX, e.clientY, false, false, false, false, 2, null);
					//	e.originalTarget.dispatchEvent(evt);

					evt.initMouseEvent("contextmenu", true, true, window, 0,
						e.screenX, e.screenY, e.clientX, e.clientY,
						false, false, false, false, 2, null);
						//e.originalTarget.dispatchEvent(evt);

					if (gContextMenu)
					{
						var item = gContextMenu.target;
						item.dispatchEvent(e);
			
						//document.popupNode = e.originalTarget;
						//var obj = document.getElementById("contentAreaContextMenu");
						//obj.showPopup(this, e.clientX, e.clientY, "context", null, null);
						  
						snaplStopPopup=true;
					}
				}
			}
		},
		
		OnMouseOut: function(e) {
			if(snaplEndWhenOut){
				if(snaplVisible == true){
					if(!e.relatedTarget){
						snaplStopPopup=true;
						drawRect();
						executeAction();
						SnapLinks.Clear();
					}
				}
			}
		},
		
		Clear: function() {
			snaplDrawing=false;

			this.Selection.Clear();
			
			if(snaplLinks && snaplLinks.length){
				for(var i=0;i<snaplLinks.length;i++){
					snaplLinks[i].style.MozOutline = "none";
				}
				snaplLinks = null;
			}
			snaplVisible=false;
			
			this.StatusBarLabel = '';
			updateStatus("");
		}
	}));
	
}, false);


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

function eventKeypress(e){
	if(e.keyCode == KeyboardEvent.DOM_VK_ESCAPE){
		SnapLinks.Clear();
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
		SnapLinks.OnMouseMove(snaplLastEventMouseOver);
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

function showSnapPopup(e) {
	pop = document.getElementById("snaplMenu");
	snaplAction=SNAPLACTION_UNDEF;
	
	// openPopupAtScreen is available since FF3.
	if (pop.openPopupAtScreen != null) {
		pop.openPopupAtScreen(e.screenX, e.screenY, true);
	} else {
		pop.showPopup(pop, e.clientX, e.clientY, "popup", 0, 0);
	}
}

function activateLinks(){
	if(snaplAction != SNAPLACTION_UNDEF){
		drawRect();
		executeAction();
		SnapLinks.Clear();
	}
}

function signalEndLoading(){
	if(snaplPostLoadingActivate){
		snaplPostLoadingActivate=false;
		activateLinks();
	}
}

function saveMouseOverEvent(e){
	if(!snaplLastEventMouseOver)
		snaplLastEventMouseOver = new Object();

	snaplLastEventMouseOver.pageX = e.pageX;
	snaplLastEventMouseOver.pageY = e.pageY;
}

function processTimeout(){
	snaplIdTimeout=0;
	drawRect();
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
		SnapLinks.Clear();
		return;
	}
	activateLinks();
	snaplAction = SNAPLACTION_DEFAULT;
}


window.addEventListener("load", start, false);
