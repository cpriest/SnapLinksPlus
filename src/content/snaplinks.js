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
 
 /*
 *	To Fix:
 * 		Scrolling while selection active does not update selection rect properly (look into using clientX + scrollX rather than pageX)
 *
 *
 *
 */
 
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
	
	/* Converts an iterable element to an array */
	function $A(iterable) {
		if (!iterable) return [];
		if ('toArray' in Object(iterable)) return iterable.toArray();
		var length = iterable.length || 0, results = new Array(length);
		while (length--) results[length] = iterable[length];
		return results;
	}

	/** Returns an array of { top, left, width, height } objects which combined make up the bounding rects of the given element, 
	* 	this uses the built-in .getClientRects() and additionally compensates for 'block' elements which it would appear is not
	* 	handled appropriately for our needs by Mozilla or the standard 
	*/
	function GetElementRects(node, offset) {
		offset = offset || { x: 0, y: 0 };
		
		var Rects = $A(node.getClientRects());
		
		$A(node.querySelectorAll('IMG')).forEach( function(elem) {
			Rects = Rects.concat( $A(elem.getClientRects()) );
		} );
		return Rects.map( function(rect) {
			return { 	top		: rect.top + offset.y, 
						left	: rect.left + offset.x, 
						bottom	: rect.top + rect.height + offset.y, 
						right	: rect.left + rect.width + offset.x };
		} );
	}

	function ApplyStyle(elem, style) {
		var OriginalStyle = { };
		Object.keys(style).forEach( function(name) {
			OriginalStyle[name] = elem.style[name];
			elem.style[name] = style[name];
		} );
		return OriginalStyle;
	}
			
	/** Selection class handles the selection rectangle and accompanying visible element */
	var Selection = Class.create({ 
		X1: 0, Y1: 0, X2: 0, Y2: 0,
		
		SelectedElements: [ ],
		
		NormalizedRect: {
			get: function() { 
				return {	X1: Math.min(this.X1,this.X2),	Y1: Math.min(this.Y1,this.Y2),
							X2: Math.max(this.X1,this.X2),	Y2: Math.max(this.Y1,this.Y2),	}
			},
		},
		
		DragStarted: false,
		
		initialize: function(PanelContainer) {
			this.PanelContainer = PanelContainer;
			this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), true);
			this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
			
			window.addEventListener('resize', this.OnWindowResize.bind(this), true);
			
			this._OnMouseMove 	= this.OnMouseMove.bind(this);
//			this._OnScroll		= this.OnScroll.bind(this);
//			this._OnMouseOut	= this.OnMouseOut.bind(this);
		},
		
		OnWindowResize: function(e) {
			if(this.DragStarted == true)
				this.CalculateSnapRects();
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
//			this.Document.addEventListener('scroll', this._OnScroll, false);
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
		//		var tabbrowser = mainWindow.document.getElementById('content');
		//		var minHeight = tabbrowser.selectedBrowser.boxObject.height;
		//		var minWidth = tabbrowser.selectedBrowser.boxObject.width;
																														
		//		SnapLinks.Selection.X1 = Math.max(Math.min(Math.max(snaplTargetDoc.width,minWidth),SnapLinks.Selection.X1),0);
		//		SnapLinks.Selection.Y1 = Math.max(Math.min(Math.max(snaplTargetDoc.height,minHeight),SnapLinks.Selection.Y1),0);
			} else {
				this.ExpandSelectionTo(Math.min(e.pageX), e.pageY);
			}
		},
		
//		OnScroll: function(e) {
//			Log('OnScroll');
//			this.ExpandSelectionTo(Math.min(e.pageX,this.Document.documentElement.offsetWidth + this.Document.defaultView.pageXOffset), e.pageY);
//		},

		OnMouseUp: function(e) {
			this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
//			this.Document.removeEventListener('scroll', this._OnScroll, false);
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
//						snaplIdTimeoutStart=window.setTimeout('processTimeoutStartRect();',50);

						snaplVisible=true;
						if(snaplShowNumber)
							SnapLinks.SnapLinksStatus = msgPanelLinks + ' 0';

						this.CalculateSnapRects();
						return true;
					}
				}
			}
			return false;
		},
		
		/** Calculates and caches the rectangles that make up all document lengths */
		CalculateSnapRects: function() {
			/* If the last calculation was done at the same innerWidth, skip calculation */
			if(this.CalculateWindowWidth == window.innerWidth)
				return;
				
			this.CalculateWindowWidth = window.innerWidth;

			var offset = { x: this.Document.defaultView.scrollX, y: this.Document.defaultView.scrollY };

			$A(this.Document.links).forEach( function( link ) {
				link.SnapRects = GetElementRects(link, offset);
			});
		},

		/** Clears the selection by removing the element, also clears some other non-refactored but moved code */
		Clear: function() {
			if (this.Element)
				this.Element.parentNode.removeChild(this.Element);
			delete this.Element;
			
			this.ClearSelectedElements();
			
			this.X1=0; this.X2=0; this.Y1=0; this.Y2=0;
			this.DragStarted = false;
			delete this.CalculateWindowWidth;
		},
		ClearSelectedElements: function() {
			this.SelectedElements.forEach( function(elem) {
				elem.style.MozOutline = '';
			} );
			this.SelectedElements = [ ];
		},
		/** Offsets the selection by the given coordinates */
		OffsetSelection: function(X, Y) {
			this.X1 += X;	this.Y1 += Y;
			this.X2 += X;	this.Y2 += Y;
			this.UpdateElement();
		},
		
		/* Expands the selection to the given X2, Y2 coordinates */
		ExpandSelectionTo: function(X, Y) {
			this.X2 = X;	this.Y2 = Y;
			this.UpdateElement();
		},
		
		UpdateElement: function() {
			if(this.Create()) {
				ApplyStyle(this.Element, {
					width 	: Math.abs(this.X1-this.X2) - snaplBorderWidth + 'px',
					height 	: Math.abs(this.Y1-this.Y2) - snaplBorderWidth + 'px',
					top 	: Math.min(this.Y1,this.Y2) - snaplBorderWidth + 'px',
					left 	: Math.min(this.X1,this.X2) - snaplBorderWidth + 'px',
				} );
				
				this.ClearSelectedElements();
				
				var SelectRect = this.NormalizedRect;
				
				$A(this.Document.links).forEach( function( link ) {
					var Intersects = link.SnapRects.some( function(Rect) {
						return !( SelectRect.X1 > Rect.right || SelectRect.X2 < Rect.left || SelectRect.Y1 > Rect.bottom || SelectRect.Y2 < Rect.top );
					});
					
					if(Intersects)
						this.SelectedElements.push(link);
				}, this );
				
				this.SelectedElements.forEach( function(elem) {
					elem.style.MozOutline = snaplLinksBorderWidth + 'px solid ' + snaplLinksBorderColor;
				} );
			}
		},
	} );
	
	var SnapLinksDebug = new (Class.create({
		Flags: {
			Links: {
				LinkStyle: 			{ border: '1px solid blue' },
				ClientRectStyle:	{ backgroundColor: 'black', opacity: .3 },
				
				OnLoad: {
					ApplyLinkStyle:			false,
					ShowClientRects:		false,
				},
				OnMouseOver: {
					ApplyLinkStyle: 		false,
					ShowClientRects:		false,
				},
			}
		},
		
		DebugLinksAtLoad: 		{ get: function() { return this.Flags.Links.OnLoad.ApplyLinkStyle || this.Flags.Links.OnLoad.ShowClientRects; }	},
		DebugLinksOnMouseOver: 	{ get: function() { return this.Flags.Links.OnMouseOver.ApplyLinkStyle || this.Flags.Links.OnMouseOver.ShowClientRects; }	},
		
		initialize: function() {
			if(this.DebugLinksAtLoad || this.DebugLinksOnMouseOver)
				gBrowser.addEventListener('load', this.OnDocumentLoaded.bind(this), true);
		},

		OnDocumentLoaded: function(e) {
			$A(e.target.links).forEach( function( link ) {
				if(this.DebugLinksAtLoad) {
					if(this.Flags.Links.OnLoad.ApplyLinkStyle)
						ApplyStyle(link, this.Flags.Links.LinkStyle);
					if(this.Flags.Links.OnLoad.ShowClientRects) {
						this.ShowClientElementRects(link);
						/* If we're showing during startup, lose the references so they are not cleared during mouse-over timeout */
						delete link.SnapDebugNodes;
					}
				}
					
				if(this.DebugLinksOnMouseOver)
					link.addEventListener('mousemove', this.OnMouseMove.bind(this, link), false);
			}, this );
		},

		ClearClientRects: function(link) {
			(link.SnapDebugNodes || []).forEach( function(elem) {
				elem.parentNode.removeChild(elem);
			} );
			link.SnapDebugNodes = [ ];
		},
		ClearVisualDebugAids: function(link) {
			this.ClearClientRects(link);
			
			link.OriginalStyle
				&& ApplyStyle(link, link.OriginalStyle)
				&& delete link.OriginalStyle;
		},

		OnMouseMove: function(link, e) {
			clearTimeout(link.SnapDebugClearTimer || 0);
			
			if(this.Flags.Links.OnMouseOver.ApplyLinkStyle) {
				var ReplacedStyle = ApplyStyle(link, this.Flags.Links.LinkStyle);
				link.OriginalStyle = link.OriginalStyle || ReplacedStyle;
			}
			
			if(this.Flags.Links.OnMouseOver.ShowClientRects)
				this.ShowClientElementRects(link);
			
			link.SnapDebugClearTimer = setTimeout(this.ClearVisualDebugAids.bind(this, link), 3000);
		},
		ShowClientElementRects: function(link) {
			this.ClearClientRects(link);

			var offset = { x: this.Document.defaultView.scrollX, y: this.Document.defaultView.scrollY };
			
			GetElementRects(link, offset).forEach( function(rect) {
				var elem = link.ownerDocument.createElement('div');
				ApplyStyle(elem, {
					position	: 'absolute',
					zIndex		: 1,
					top			: rect.top + 'px',
					left		: rect.left + 'px',
					width		: (rect.right - rect.left) + 'px',
					height		: (rect.bottom - rect.top) + 'px',
					cursor		: 'pointer',
				} );
				ApplyStyle(elem, this.Flags.Links.ClientRectStyle);
				
				/* Pass through any clicks to this div to the original link */
				elem.addEventListener('click', function(e) {
					var evt = document.createEvent('MouseEvents');
					evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
					link.dispatchEvent(evt); 
				}, true);
				link.ownerDocument.body.appendChild(elem);
				link.SnapDebugNodes.push(elem);
			}, this );
		}
	}))();
	
	SnapLinks = new (Class.create( {
				
		SnapLinksStatus: {
			set: function(x) {
				var el = document.getElementById('snaplinks-panel') ;
				el && (el.label = x);
				el && (el.hidden = (x == ''));
			} 
		},
		StatusBarLabel: {	set: function(x) { document.getElementById('statusbar-display').label = x; }	},
		
		initialize: function() {
			snaplUpdateOptions();
			
			snaplButton = snaplRMB;
			snaplPostLoadingActivate=false;
			snaplAction=SNAPLACTION_DEFAULT;

			this.PanelContainer = document.getElementById('content').mPanelContainer;
			this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), true);
			this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
			this.PanelContainer.addEventListener('keypress', this.OnKeyPress.bind(this), true);

			this._OnMouseMove 	= this.OnMouseMove.bind(this);
			this._OnMouseOut	= this.OnMouseOut.bind(this);
			this._OnKeyDown		= this.OnKeyDown.bind(this);
			this._OnKeyUp		= this.OnKeyUp.bind(this);
			this._OnScroll		= this.OnScroll.bind(this);

			document.getElementById('contentAreaContextMenu')
				.addEventListener('popupshowing', this.OnContextMenuShowing.bind(this), false);
				
			document.getElementById('snaplMenu')
				.addEventListener('popuphidden',this.OnSnapLinksPopupHidden.bind(this),false)

			this.Selection = new Selection(this.PanelContainer);

			this.SnapLinksStatus = '';
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
			this.PanelContainer.addEventListener('keydown', this._OnKeyDown, true);
			this.PanelContainer.addEventListener('keyup', this._OnKeyUp, true);
			document.addEventListener('scroll', this._OnScroll, false);
		},
		
		OnMouseMove: function(e) {
			if(snaplDrawing == false || snaplPostLoadingActivate == true || !snaplAction)
				return;

//			this.UpdateStatusLabel();
//			if(!snaplIdTimeout)
//				snaplIdTimeout=window.setTimeout('processTimeout();',300);
		},
		
		OnMouseUp: function(e) {
			if(e.button != snaplButton)
				return;
			if(snaplPostLoadingActivate)
				return;

			this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
			this.PanelContainer.removeEventListener('mouseout', this._OnMouseOut, true);
			this.PanelContainer.removeEventListener('keydown', this._OnKeyDown, true);
			this.PanelContainer.removeEventListener('keyup', this._OnKeyUp, true);
			document.removeEventListener('scroll', this._OnScroll, false);

			if(this.Selection.DragStarted == true){
				snaplStopPopup=true;
				if(e.ctrlKey) {
					showSnapPopup(e);
				} else
					this.ActivateSelection();
				
//				if(!stillLoading()){
//				}else{
//					snaplPostLoadingActivate = true;
//				}
			} else {
				SnapLinks.Clear();
				if(snaplButton == snaplRMB){
					var evt = document.createEvent('MouseEvents');
					snaplStopPopup=false;

					evt.initMouseEvent('contextmenu', true, true, window, 0,
						e.screenX, e.screenY, e.clientX, e.clientY,
						false, false, false, false, 2, null);
					e.originalTarget.dispatchEvent(evt);

					if (gContextMenu) {
						var item = gContextMenu.target;
						item.dispatchEvent(e);
			
						document.popupNode = e.originalTarget;
						var obj = document.getElementById('contentAreaContextMenu');
						obj.showPopup(this, e.clientX, e.clientY, 'context', null, null);
						  
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
//						drawRect();
						this.ActivateSelection();
					}
				}
			}
		},
		
		OnKeyPress: function(e) {
			if(e.keyCode == KeyboardEvent.DOM_VK_ESCAPE)
				SnapLinks.Clear();
		},
		
		OnKeyDown: function(e) {
			if(e.keyCode == KeyboardEvent.DOM_VK_SHIFT ){
//				snaplEqualSize = false;
//				drawRect();
			}
		},
		
		OnKeyUp: function(e) {
			if(e.keyCode == KeyboardEvent.DOM_VK_SHIFT ){
//				snaplEqualSize = true;
//				drawRect();
			}
		},
		
		OnScroll: function(e) {
//			scrollUpdate();
		},

		OnContextMenuShowing: function(e){
			if((snaplStopPopup==true) && (snaplButton==snaplRMB)){
				e.preventDefault();
				snaplStopPopup=false;
				return false;
			}
		},

		OnSnapLinksPopupHidden: function(e){
			SnapLinks.Clear();
		},
		
		Clear: function() {
			snaplDrawing=false;

			this.Selection.Clear();
			
			if(snaplLinks && snaplLinks.length){
				for(var i=0;i<snaplLinks.length;i++){
					snaplLinks[i].style.MozOutline = 'none';
				}
				snaplLinks = null;
			}
			snaplVisible=false;
			
			this.StatusBarLabel = '';
			this.SnapLinksStatus = '';
		},

		ACTION: {
			DEFAULT				: 'OpenTabs',
			NEW_TABS			: 'OpenTabs',
			NEW_WINDOWS			: 'OpenWindows',
			TABS_IN_NEW_WINDOW	: 'OpenTabsInNewWindow',
			COPY_TO_CLIPBOARD	: 'CopyToClipboard',
			BOOKMARK_LINKS		: 'BookmarkLinks',
			DOWNLOAD_LINKS		: 'DownloadLinks',
		},
		
		ActivateSelection: function(Action) {
			Action = Action || this.ACTION.DEFAULT;
			if(this[Action])
				this[Action]();
			this.Clear();
		},
		
		OpenTabs: function() {
			this.Selection.SelectedElements.forEach( function(elem) {
				if(elem.href)
					getBrowser().addTab(elem.href,makeReferrer());
			} );
		},
		OpenWindows: function() {
			SnapLinks.Selection.SelectedElements.forEach( function(elem) {
				if(elem.href)
					window.open(elem.href);
			} );
		},
		OpenTabsInNewWindow: function() {
			if(SnapLinks.Selection.SelectedElements.length) {
				var urls = SnapLinks.Selection.SelectedElements.map( function(elem) {
					return elem.href;
				} ).join('|');

		/*	if (!urls) {
				// It seems that we did not have any links after all.
				// Let's use the default arguments. 
				var browserHandler = Components.classes["@mozilla.org/browser/clh;1"].
					getService(Components.interfaces.nsIBrowserHandler);

				urls = browserHandler.defaultArgs;
			}
		*/	
				return window.openDialog("chrome://browser/content/", "_blank", "all,chrome,dialog=no", urls);
			}
		},
		CopyToClipboard: function() {
			var Representations = SnapLinks.Selection.SelectedElements.reduce( function(acc, elem) {
				var text = elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');

				acc.html.push( '<a href="' + elem.href + '">' + text + '</a>' );
				acc.text.push( elem.href );
				return acc;
			}, { html: [ ], text: [ ] } );

			// Create the transferable
			var objData = Components.classes["@mozilla.org/widget/transferable;1"]
							.createInstance(Components.interfaces.nsITransferable);
			
			if(objData) {
				var TextContent = Components.classes["@mozilla.org/supports-string;1"]
									.createInstance(Components.interfaces.nsISupportsString);
				if(TextContent) {
					TextContent.data = Representations.text.join(' ');

					objData.addDataFlavor('text/unicode');
					objData.setTransferData('text/unicode', TextContent, TextContent.data.length * 2);	/* Double byte data (len*2) */
				}

				var HtmlContent = Components.classes["@mozilla.org/supports-string;1"]
									.createInstance(Components.interfaces.nsISupportsString);
				if(HtmlContent) {
					HtmlContent.data = Representations.html.join("\n");
					
					objData.addDataFlavor('text/html');
					objData.setTransferData('text/html', HtmlContent, HtmlContent.data.length * 2);	/* Double byte data (len*2) */
				}

				var objClipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
									.getService(Components.interfaces.nsIClipboard);
				if (objClipboard)
					objClipboard.setData(objData, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
			}
		},
		BookmarkLinks: function() {
			if(SnapLinks.Selection.SelectedElements.length) {
				/* Does not work, find way to add bookmarks to FF4 - @BROKEN */
				var linksInfo = SnapLinks.Selection.SelectedElements.map( function(elem) {
					return { 
						name	: elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '),
						url		: elem.href,
					};
				} );
				const BROWSER_ADD_BM_FEATURES = 'centerscreen,chrome,dialog=no,resizable=yes';
				
				var dialogArgs = { name: gNavigatorBundle.getString("bookmarkAllTabsDefault") }
				dialogArgs.bBookmarkAllTabs = true;
				dialogArgs.objGroup = linksInfo;
				openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "", BROWSER_ADD_BM_FEATURES, dialogArgs);
			}
		},
		DownloadLinks: function() {
			if(SnapLinks.Selection.SelectedElements.length) {
				var TitlesUsed = { };
				
				var links = SnapLinks.Selection.SelectedElements.map( function(elem) {
					var Title = elem.textContent.replace(/\s{2,}/g, ' ').replace(/ /g,'_').replace(/[^a-zA-Z0-9_]+/g, '').substring(0, 75);
					
					/* Ensure Uniqueness of Filename */
					for(var j=0;j<99;j++) {
						var TitleCheck = Title;
						if(j > 0)
							TitleCheck += '' + j;
						if(TitlesUsed[TitleCheck] == undefined) {
							Title = TitleCheck
							break;
						}
					}
					TitlesUsed[Title] = true;
					
					return { FileName: Title, Url: elem.href };
				} );
				links.forEach( function( link ) {
					const BYPASS_CACHE = true;
					const DONT_SKIP_PROMPT = false;
					
					try { saveURL(link.Url, link.FileName, false, BYPASS_CACHE, DONT_SKIP_PROMPT, makeReferrer()); } 
						catch(e) { }
				} );
			}
		},
	}));
	
}, false);

function showSnapPopup(e) {
	pop = document.getElementById('snaplMenu');
//	snaplAction=SNAPLACTION_UNDEF;		/* Probably needed to circumvent bad design, possibly no longer needed */
	
	// openPopupAtScreen is available since FF3.
	if (pop.openPopupAtScreen != null) {
		pop.openPopupAtScreen(e.screenX, e.screenY, true);
	} else {
		pop.showPopup(pop, e.clientX, e.clientY, 'popup', 0, 0);
	}
}

function signalEndLoading(){
	if(snaplPostLoadingActivate){
		snaplPostLoadingActivate=false;
		SnapLinks.ActivateSelection();
	}
}

function processTimeout(){
	snaplIdTimeout=0;
	drawRect();
}
