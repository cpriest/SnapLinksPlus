/*
 *  Selection.js
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
 */


/*	@MARK - Future Plans
 * 		- StatusLabel to show more detail (via options) (Filtered, Type Counts)
 * 		- Filtered elements to have grey outline
 *		- Tutorial Page (with ability to change prefs in some cases)
 */

	/*
	 *  @TODO	Outstanding Minor Issues:
	 *  @TODO		- Outline of some elements 'hidden' -- outline/border/box-shadow all subject to parent overflow: hidden,
	 *  				Possible solutions include:
	 *  					box-shadow: 0px 0px 1px 0px red (inner shadow, tighter and not as preferable)
	 *  					New outline element per selection (probably would be very slow, maybe less so with an 'outline element cache for created but no longer used')
	 *  @BUG	Right-click on Flash object
	 **/

var EXPORTED_SYMBOLS = ["SnapLinksSelectionClass"];

var Cu = Components.utils,
	Cc = Components.classes,
	Ci = Components.interfaces;

try {
	Cu.import('resource://gre/modules/Services.jsm');
	Cu.import("chrome://snaplinksplus/content/Utility.js");
	Cu.import("chrome://snaplinksplus/content/WindowFaker.js");
	Cu.import('chrome://snaplinksplus/content/Preferences.js');
} catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

/** Selection class handles the selection rectangle and accompanying visible element */
var SnapLinksSelectionClass = Class.create({
	SnapLinksPlus: null,
	jsRegExp: /^javascript:/i,

	/* On Demand Creation of Xul Outline Element */
	get XulOutlineElem() {
		if(!this._XulOutlineElement) {
			let InsertionNode = this.TabBrowser.selectedBrowser.parentNode;
			let Element = CreateAnonymousElement('<box></box>');
			if(InsertionNode && Element) {
				ApplyStyle(Element, {
					color				: SLPrefs.Selection.BorderColor,
					borderStyle			: 'dotted',
					borderTopWidth		: SLPrefs.Selection.BorderWidth+'px',
					borderLeftWidth		: SLPrefs.Selection.BorderWidth+'px',
					borderBottomWidth	: SLPrefs.Selection.BorderWidth+'px',
					borderRightWidth	: SLPrefs.Selection.BorderWidth+'px',

					display				: 'none',
					position			: 'fixed',
					zIndex				: '999999',
					pointerEvents		: 'none',
				});
				InsertionNode.appendChild(Element);
				this._XulOutlineElement = Element;
			}
		}
		return this._XulOutlineElement;
	},
	set XulOutlineElem(x) {
		if(x == undefined && this._XulOutlineElement)
			try { this._XulOutlineElement.parentNode.removeChild(this._XulOutlineElement); } catch(e) { console.log('Exception on XulOutlineElem removal: x=%o, e=%o', x, e); }
		this._XulOutlineElement = x;
	},

	/* Dynamic creation/deletion of XulCountElem (Floating Selection Count) */
	get XulCountElem() {
		if(!this._XulCountElem && SLPrefs.Selection.ShowCount && SLPrefs.Selection.ShowCountWhere == SLE.ShowCount_Hover) {
			let InsertionNode = this.XulOutlineElem.parentNode;
			let ElementCount = CreateAnonymousElement('<box></box>');
			if(InsertionNode && ElementCount) {
				ApplyStyle(ElementCount, {
					padding        : '2px 4px',
					font           : '12px Verdana',
					border         : '1px solid black',
					backgroundColor: '#FFFFCC',

					display        : 'none',
					position       : 'fixed',
					zIndex         : '999999',
					pointerEvents  : 'none',
				});
				InsertionNode.insertBefore(ElementCount, this.XulOutlineElem.nextSibling);
				this._XulCountElem = ElementCount;
			}

			if(SLPrefs.Selection.ShowCount)
				this.SelectedCountsLabel = [ 0 ];
		}
		return this._XulCountElem;
	},
	set XulCountElem(x) {
		if(x == undefined && this._XulCountElem)
			try { this._XulCountElem.parentNode.removeChild(this._XulCountElem); } catch(e) { console.log('Exception on XulCountElem removal: x=%o, e=%o', x, e); }
		this._XulCountElem = x;
	},

	set SelectedCountsLabel(tValues) {
		let label = '';

		if(tValues != '')
			label = this.SnapLinksPlus.LocaleBundle.formatStringFromName("snaplinks.status.links", tValues, 1);

		this.SnapLinksPlus.SnapLinksStatus = label;

		if (this.XulCountElem)
			this.XulCountElem.textContent = label;
	},

	/* Rect coordinates of "browser pane" in fixed coordinates of ChromeWindow, adjusted for scroll bar */
	get FixedBrowserRect() {
		let pbo = this.XulOutlineElem.parentNode.boxObject,				/* Parent Box Object */
			sbw = this.TabBrowser.selectedBrowser.contentWindow;	/* Selected Browser Window */

		try {
			return new Rect( pbo.y, pbo.x,
				/* bottom */	pbo.y + pbo.height - (sbw.scrollMaxX != 0 ? 16 : 0),	/* ScrollBar Adjustment */
				/* right */		pbo.x + pbo.width  - (sbw.scrollMaxY != 0 ? 16 : 0));	/* ScrollBar Adjustment */
		} catch(e) {
			return new Rect(0, 0, 0, 0);
		}
	},

	/* Internal flag to control selecting all links or all links matching the greatest size */
	SelectLargestFontSizeIntersectionLinks:		true,

	/* Returns an array of elements representing the selected elements
	 *	taking into account preferences for removing duplicate urls 
	 */
	get FilteredElements() {
		if(this.SelectedElementsType != 'Links' &&
				this.SelectedElementsType != 'JsLinks') {
			return [ ];
		}

		var Distinct = [ ];
		return this.SelectedElements.filter( function(elem) {
			if(!elem.href || (SLPrefs.Elements.Anchors.RemoveDuplicateUrls && Distinct.indexOf(elem.href) != -1))
				return false;
			Distinct.push(elem.href);
			return true;
		}, this);
	},

	/* Internal Flag indicating that a selection has been started */
	get DragStarted() { return this.XulOutlineElem.style.display != 'none'; },

	initialize: function(SnapLinksPlus) {
		this.SnapLinksPlus = SnapLinksPlus;
		this.ChromeWindow = SnapLinksPlus.ChromeWindow;
		this.XulDocument = SnapLinksPlus.XulDocument;
		this.PanelContainer = SnapLinksPlus.PanelContainer;
		this.TabBrowser = this.XulDocument.getElementById('content');
		this.TabBrowser.addEventListener('mousedown', this.OnMouseDown.bind(this), true);

		this._OnDocScroll			= this.OnDocScroll.bind(this);
		this._OnResize				= this.OnResize.bind(this);
		this._OnMouseMove 			= this.OnMouseMove.bind(this);
		this._OnMouseUp 			= this.OnMouseUp.bind(this);
		this._OnDocumentUnloaded	= this.OnDocumentUnloaded.bind(this);
		this._OnDocumentLoaded		= this.OnDocumentLoaded.bind(this);
		this._OnElementMutation		= this.OnElementMutation.bind(this);
		this._OnKeyDown				= this.OnKeyDown.bind(this);
		this._OnKeyUp				= this.OnKeyUp.bind(this);

		this.CalcSelectedElements	= CapCallFrequency(this.CalcSelectedElements.bind(this), SLPrefs.Calc.SelectedFrequencyCap);

		this.LastCalcTime = 0;
	},

	/* Index all documents by URL and calculate offset from Top Document */
	IndexDocuments: function IndexDocuments(TopDocument) {
		var Documents = { };

		/* Insert top document */
		Documents[TopDocument.URL] = TopDocument;

		function IndexFrames(frame) {
			for(let j=0; j < frame.length; j++) {
				/* Unusual case where a sub-frame has the same URL as the TopDocument, skipping this frame in this case, see this page for issue: https://groups.google.com/forum/#!msg/snaplinksplus/7a18LX7n6uM/5A39Mdlx5RQJ */
				if(frame[j].document.URL == TopDocument.URL)
					continue;

				Documents[frame[j].document.URL] = frame[j].document;
				IndexFrames(frame[j]);
			}
		}
		IndexFrames(TopDocument.defaultView);

		for(let URL in Documents)
			this.CalculateSelectableElements(Documents[URL]);

		dc('doc-index', '%o', Documents);
		this.Documents = Documents;
	},

	InnerScreen: function(e) {
		if(e && e.screenX)
			this.MouseScreenPos = new Point(e.screenX / this.PixelScale, e.screenY / this.PixelScale);

		let top = this.top,
			topClientX = this.MouseScreenPos.x - top.mozInnerScreenX,
			topClientY = this.MouseScreenPos.y - top.mozInnerScreenY,
			topPageX = topClientX + top.scrollX,
			topPageY = topClientY + top.scrollY;

		return [top, topClientX, topClientY, topPageX, topPageY];
	},

	ShouldActivate: function(e) {
		if(!this.SnapLinksPlus.ShouldActivate(e))
			return false;

		this.top = e.view.top;
		this.CalcPixelScale();

		dc('doctree', DumpWindowFrameStructure.bind(DumpWindowFrameStructure, this.top));

		return true;
	},

	CalcPixelScale: function() {
		this.topPixelScale = this.top.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils).screenPixelsPerCSSPixel;
		this.xulPixelScale = parseFloat(Services.prefs.getCharPref('layout.css.devPixelsPerPx'));
		if(isNaN(this.xulPixelScale) || this.xulPixelScale <= 0) {
			this.xulPixelScale = 1;
			try { this.xulPixelScale = parseFloat(Components.classes["@mozilla.org/gfx/screenmanager;1"].getService(Components.interfaces.nsIScreenManager).systemDefaultScale); }
				catch(e) { console.log('SnapLinksPlus: nsIScreenManager.systemDefaultScale not available, accomodating OS level dpi changes not possible, exception follows.'); Components.utils.reportError(e); this.xulPixelScale = 1; }
		}
		this.PixelScale = this.topPixelScale / this.xulPixelScale;
	},

//|																																																																																																																																	*/
//|	  Event Handlers																																																																																																																												*/
//|																																																																																																																																	*/

	/* Starting Hook for beginning a selection */
	OnMouseDown: function(e) {
		if(SLPrefs.Dev.Mode && e.ctrlKey && e.shiftKey && e.button == 0) {
			console.clear();	e.stopPropagation();	e.preventDefault();
			return;
		}
		if(!this.ShouldActivate(e))
			return;

		let [top, topClientX, topClientY, topPageX, topPageY] = this.InnerScreen(e);

		this.IndexDocuments(this.top.document);

		/** Initializes the starting mouse position in the page coordinates of the top document */
		this.SelectionRect = new Rect(topPageY, topPageX);

		if(e.target && e.target.tagName == 'A') {
			var computedStyle = e.target.ownerDocument.defaultView.getComputedStyle(e.target, null);
			this.SelectedFixedFontSize = parseFloat(computedStyle.getPropertyValue("font-size"));
		}

		this.InstallEventHooks();
	},

	InstallEventHooks: function() {
		this.ChromeWindow.addEventListener('mousemove', this._OnMouseMove, true);
		this.ChromeWindow.addEventListener('mouseup', this._OnMouseUp, true);
		this.ActiveBrowser = this.TabBrowser.selectedBrowser;
		this.ActiveBrowser.addEventListener('load', this._OnDocumentLoaded, true);
		this.ActiveBrowser.addEventListener('DOMContentLoaded', this._OnDocumentLoaded, true);
		this.ActiveBrowser.addEventListener('unload', this._OnDocumentUnloaded, true);
		this.ActiveBrowser.addEventListener('scroll', this._OnDocScroll, true);
		this.ActiveBrowser.addEventListener('resize', this._OnResize, true);
		this.ActiveBrowser.addEventListener('keydown', this._OnKeyDown, true);
		this.ActiveBrowser.addEventListener('keyup', this._OnKeyUp, true);
	},

	RemoveEventHooks: function() {
		this.ChromeWindow.removeEventListener('mousemove', this._OnMouseMove, true);
		this.ChromeWindow.removeEventListener('mouseup', this._OnMouseUp, true);
		this.ActiveBrowser.removeEventListener('load', this._OnDocumentLoaded, true);
		this.ActiveBrowser.removeEventListener('DOMContentLoaded', this._OnDocumentLoaded, true);
		this.ActiveBrowser.removeEventListener('unload', this._OnDocumentUnloaded, true);
		this.ActiveBrowser.removeEventListener('scroll', this._OnDocScroll, true);
		this.ActiveBrowser.removeEventListener('resize', this._OnResize, true);
		this.ActiveBrowser.removeEventListener('keydown', this._OnKeyDown, true);
		this.ActiveBrowser.removeEventListener('keyup', this._OnKeyUp, true);
		delete this.ActiveBrowser;
	},

	OnMouseMove: function(e) {
		let [top, topClientX, topClientY, topPageX, topPageY] = this.InnerScreen(e);

		/* If we have an off screen scroll interval set, clear it */
		clearTimeout(this.ScrollInterval);

		/* Out of top document detection and action */
		if(topClientX < 0 || topClientY < 0 || topClientX > top.innerWidth || topClientY > top.innerHeight) {
			if(SLPrefs.Selection.HideOnMouseLeave) {
				this.HideSelectionRect(true);
				return;
			} else {
				let offsetX = 0, offsetY = 0;

				if(topClientX < 0)
					offsetX = topClientX;
				else if(topClientX > top.innerWidth)
					offsetX = topClientX - top.innerWidth;

				if(topClientY < 0)
					offsetY = topClientY;
				else if(topClientY > top.innerHeight)
					offsetY = topClientY - top.innerHeight;

				/* Scroll Window */
				top.scrollBy(offsetX, offsetY);

				/* Scroll Window every N time period, even on no mouse move basically by repeating this same mousemove event */
				this.ScrollInterval = setInterval(this.OnMouseMove.bind(this, e), 25);
			}
		} else if(this.XulOutlineElem.style.display == 'none')
			this.HideSelectionRect(false);

		/* Disabled At The Moment */
//		if(false && e.altKey && !SLPrefs.Activation.RequiresAlt) {
//			this.OffsetSelection(pageX - this.SelectionRect.right, pageY - this.SelectionRect.bottom);
//		} else {
			this.ExpandSelectionTo(topPageX, topPageY);
//		}
	},

	OnMouseUp: function(e) {
		if(e.button != SLPrefs.Activation.Button)
			return;

		clearTimeout(this.CalcTimer);		delete this.CalcTimer;
		clearTimeout(this.ScrollInterval);	delete this.ScrollInterval;
		this.RemoveEventHooks();
	},

	OnDocScroll: function(e) {
		let [top, topClientX, topClientY, topPageX, topPageY] = this.InnerScreen();

		this.ExpandSelectionTo(topPageX, topPageY);
	},

	OnResize: function(e) {
		/* We aren't getting an update mouse position, but scaling has possibly changed.
		 		Adjust stored mouse position to potential new scale */
		let OldPixelScale = this.PixelScale;
		this.CalcPixelScale();
		this.MouseScreenPos.scale(OldPixelScale / this.PixelScale);

		for(let URL in this.Documents)
			this.CalculateSelectableElements(this.Documents[URL]);

		let [top, topClientX, topClientY, topPageX, topPageY] = this.InnerScreen();

		this.ExpandSelectionTo(topPageX, topPageY);
	},

	OnDocumentLoaded: function(e) {
		this.CalculateSelectableElements(e.target);
		this.Documents[e.target.URL] = e.target;
		this.CalcSelectedElements();
	},
	OnDocumentUnloaded: function(e) {
		if(e.target.URL == this.top.document.URL) {
			this.Documents = [ ];
			this.SelectedElements = [ ];
			return;
		}
		if(this.Documents && this.Documents[e.target.URL]) {
			this.ClearSelectedElements(e.target);
			delete this.Documents[e.target.URL];
		}
	},

	OnElementMutation: function(mutations) {

		let MutatedDocURLs = mutations.reduce(function(acc, mu) {
			for(let nodes of [ mu.addedNodes, mu.removedNodes ]) {
				if(nodes) {
					for(let elem of nodes)
						acc[elem.ownerDocument.URL] = true;
				}
			}
			return acc;
		}, { });
		for(let URL in MutatedDocURLs)
			this.Documents[URL].SLPD.CalculateSelectable();
	},

	OnKeyDown: function(e) {
		switch(e.keyCode) {
			case KeyEvent.DOM_VK_SHIFT:
				if(!this.ShiftDown) {
					this.ShiftDown = true;
					this.CalcSelectedElements();
				}
				break;
		}
	},

	OnKeyUp: function(e) {
		switch(e.keyCode) {
			case KeyEvent.DOM_VK_SHIFT:
				if(this.ShiftDown) {
					this.ShiftDown = false;
					this.CalcSelectedElements();
				}
				break;
		}
	},

	/** Offsets the selection by the given coordinates */
	OffsetSelection: function(X, Y) {
		this.SelectionRect.Offset(X, Y);
		this.UpdateElement();
	},

	/* Expands the selection to the given X, Y coordinates */
	ExpandSelectionTo: function(X, Y) {
		let top = this.top;

		this.SelectionRect.right = Math.max(0, Math.min(X, top.innerWidth + top.scrollMaxX));
		this.SelectionRect.bottom = Math.max(0, Math.min(Y, top.innerHeight + top.scrollMaxY));
		this.UpdateElement();
	},

//|																																																																																																																																	*/
//|	  Calculation Functions																																																																																																																												*/
//|																																																																																																																																	*/

	/** Calculates and caches the rectangles that make up all document lengths */
	CalculateSelectableElements: function(Doc) {
		if(!Doc.SLPD) {
			Doc.SLPD = {
				info				: 'SnapLinksPlus Document Data',
				MutationObserver	: new this.top.MutationObserver(this._OnElementMutation),
				CalculateSelectable	: new CapCallFrequency(this.CalculateSelectableElements.bind(this, Doc), SLPrefs.Calc.SelectableFrequencyCap),
			};
			Doc.SLPD.MutationObserver.observe(Doc, {
				childList: true, subtree: true,
			});
		}

		Doc.SLPD.CalculatedWindowWidth = Doc.defaultView.innerWidth;

		var offset = { x: Doc.defaultView.scrollX, y: Doc.defaultView.scrollY };
		var SelectableElements = [ ];

		var Start = (new Date()).getTime();

		$A(Doc.links).forEach( function( link ) {
			try {
				link.SnapIsJsLink = this.jsRegExp.test(link.href); // Is a JavaScript link?

				// Skip JavaScript links, if the option is disabled.
				if (link.SnapIsJsLink &&
						!SLPrefs.Elements.JSLinks.Highlight) {
					return;
				}
			} catch (e) {
				Components.utils.reportError(e);
			}

			delete link.SnapFontSize;
			link.SnapOutlines = [ link ];
			link.SnapRects = GetElementRects(link, offset);
			SelectableElements.push(link);
		}, this);

		var Links = (new Date()).getTime();

		$A(Doc.body.querySelectorAll('INPUT')).forEach( function(input) {
			let Type = input.getAttribute('type'),
				ElementRectsNode = input;

			if(SLPrefs.Elements.Buttons.Highlight && (Type == 'submit' || Type == 'button')) {
				input.SnapOutlines = [ input ];
				input.SnapRects = GetElementRects(ElementRectsNode, offset);
				SelectableElements.push(input);
			} else if( (SLPrefs.Elements.RadioButtons.Highlight && Type == 'radio') || (SLPrefs.Elements.Checkboxes.Highlight && Type == 'checkbox') ) {
				if(input.parentNode.tagName == 'LABEL') {
					ElementRectsNode = input.parentNode;
					input.SnapOutlines = [ input.parentNode ];
				} else
					input.SnapOutlines = [ input ];
				input.SnapRects = GetElementRects(ElementRectsNode, offset);
				SelectableElements.push(input);
			}
		}, this);

		var Inputs = (new Date()).getTime();

		$A(Doc.body.querySelectorAll('LABEL')).forEach( function(label) {
			var forId = label.getAttribute('for');
			if (forId != null && forId != '') {
				var ForElement;

				try {
					ForElement = Doc.body.querySelector('INPUT[type=checkbox]#'+forId);
				} catch(e) {
					// If querySelector() fails, the ID is probably illegal.
					// We can still find the element by using getElementById().
					var idElem = Doc.getElementById(forId);
					if (idElem &&
							idElem.tagName == 'INPUT' &&
							idElem.type.toLowerCase() == 'checkbox'	) {
						ForElement = idElem;
					}
				}

				if (ForElement != undefined) {
					ForElement.SnapRects = ForElement.SnapRects.concat(GetElementRects(label, offset));
					ForElement.SnapOutlines = [ ForElement, label ];
				}
			}
		});

		var Labels = (new Date()).getTime();

		/* Get list of ineligible elements for 'clickable' */
		var AnchoredElems = $A(Doc.body.querySelectorAll('A[href] IMG, A[href] SPAN, A[href] DIV'));

		$A(Doc.body.querySelectorAll('IMG, SPAN, DIV'))
			.filter( function(elem) { return AnchoredElems.indexOf(elem) == -1; })
			.forEach( function(elem) {
				if(elem.SnapLinksClickable || (elem.ownerDocument.defaultView.getComputedStyle(elem) || { }).cursor == 'pointer') {
					elem.SnapLinksClickable = true;
					elem.SnapRects = GetElementRects(elem, offset);
					elem.SnapOutlines = [ elem ];
					SelectableElements.push(elem);
				}
			});

		Doc.SLPD.SelectableElements = SelectableElements;

		var End = (new Date()).getTime();
		dc('performance', "CalculateSelectableElements() -> Links: %sms, Inputs: %sms, Labels: %sms, Clickable: %sms, Total: %sms",
			Links - Start, Inputs - Links, Labels - Inputs, End - Labels, End - Start);
	},

	/* Calculates which elements intersect with the selection */
	CalcSelectedElements: function() {
		var SelectLargestFontSizeIntersectionLinks = !this.ShiftDown;

		if(this.XulOutlineElem.style.display != 'none') {
			let HighLinkFontSize = 0, HighJsLinkFontSize = 0,
				IntersectedElements = [ ],
				top = this.top;

			let TypesInPriorityOrder = ['Links', 'JsLinks', 'Checkboxes', 'Buttons', 'RadioButtons', 'Clickable'],
				TypeCounts = {'Links': 0, 'JsLinks': 0, 'Checkboxes': 0, 'Buttons': 0, 'RadioButtons': 0, Clickable: 0};

			/**	@debug DebugRects
			  *	file:///c:/code/xul/snaplinks/test/iframe_content.htm
			  *	file:///c:/code/xul/snaplinks/test/iframe_iframe_content.htm
			  */
//			let DebugRectsDocumentURL = 'file:///c:/code/xul/snaplinks/test/iframe_content.htm';

			for(let URL in this.Documents) {
				//noinspection JSUnfilteredForInLoop
				let Doc = this.Documents[URL];
				let IntersectRect, DocRect, elem;

				/* If we are the top document. use documents height/width, otherwise use sub-documents viewport height/width */
				DocRect = new Rect(0, 0, Doc.defaultView.innerHeight, Doc.defaultView.innerWidth);
				if(Doc == top.document) {
					DocRect.right += Doc.defaultView.scrollMaxX;
					DocRect.bottom += Doc.defaultView.scrollMaxY;
				} else {
					/* Calculate ParentDocRect in top document coordinates */
					let ParentWindow = Doc.defaultView.parent,
						ParentDocRect = new Rect(0, 0, ParentWindow.innerHeight, ParentWindow.innerWidth);

					if(ParentWindow == top) {
						ParentDocRect.right += ParentWindow.scrollMaxX;
						ParentDocRect.bottom += ParentWindow.scrollMaxY;
					} else {
						ParentDocRect.Offset(ParentWindow.mozInnerScreenX - top.mozInnerScreenX + top.scrollX, ParentWindow.mozInnerScreenY - top.mozInnerScreenY + top.scrollY);
					}

					DocRect.Offset(Doc.defaultView.mozInnerScreenX - top.mozInnerScreenX + top.scrollX, Doc.defaultView.mozInnerScreenY - top.mozInnerScreenY + top.scrollY);

					/** @debug DebugRects */
//					if(URL == DebugRectsDocumentURL) {
//						!Doc.SLPD.DebugRects_Red && (Doc.SLPD.DebugRects_Red = this.SnapLinksPlus.Debug.CreateHighlightRect(top.document, ParentDocRect, { border: '1px solid red', backgroundColor: 'red', opacity: '.3'   } ));
//						!Doc.SLPD.DebugRects_Yel && (Doc.SLPD.DebugRects_Yel = this.SnapLinksPlus.Debug.CreateHighlightRect(top.document, DocRect, { border: '1px solid yellow', backgroundColor: 'yellow', opacity: '.3'   } ));
//					}

					/* Clip sub-document rect by parent document rect */
					if((DocRect = DocRect.GetIntersectRect(ParentDocRect)) == false)
						continue;

					/** @debug DebugRects */
//					if(URL == DebugRectsDocumentURL)
//						!Doc.SLPD.DebugRects_Blu && (Doc.SLPD.DebugRects_Blu = this.SnapLinksPlus.Debug.CreateHighlightRect(top.document, DocRect, { border: '1px solid blue', backgroundColor: 'blue', opacity: '.3'   } ));
				}

				/* Clip SelectionRect by DocRect, If we have no SelectRect then there is no intersection with Doc's coordinates */
				if((IntersectRect = this.SelectionRect.GetIntersectRect(DocRect)) == false)
					continue;

				/** @debug DebugRects */
//				if(URL == DebugRectsDocumentURL) {
//					Doc.SLPD.DebugRects_Green && Doc.SLPD.DebugRects_Green.parentNode.removeChild(Doc.SLPD.DebugRects_Green);
//					Doc.SLPD.DebugRects_Green = this.SnapLinksPlus.Debug.CreateHighlightRect(top.document, IntersectRect, { border: '1px solid green', backgroundColor: 'green', opacity: '.3' } );
//				}

				/* If we're not in the top document, translate SelectRect from top document back to sub-document coordinates */
				if(Doc != top.document) {
					IntersectRect.Offset(/* By differences in topleft of sub-doc to top-doc					reduce by scroll amount		add sub-document scroll amount */
											-(Doc.defaultView.mozInnerScreenX - top.mozInnerScreenX)	+	-top.scrollX 		+		Doc.defaultView.scrollX,
											-(Doc.defaultView.mozInnerScreenY - top.mozInnerScreenY)	+	-top.scrollY		+		Doc.defaultView.scrollY);
				}

				dc('calc-elements', '%o.SLPD.SelectableElements = %o', Doc, Doc.SLPD.SelectableElements);
//				!Doc.SLPD && console.log('SLPD missing for Url #%s, Doc=%o', usn(URL), Doc);
//				!Doc.SLPD.SelectableElements && console.log('SLPD.SelectableElements missing for Url #%s, Doc=%o, Doc.SLPD=%o', usn(URL), Doc, Doc.SLPD);
//				!Doc.SLPD.SelectableElements.length == undefined && console.log('SLPD.SelectableElements.length missing for Url #%s, Doc=%o, Doc.SLPD=%o', usn(URL), Doc, Doc.SLPD);

				/* Find Links Which Intersect With SelectRect */
				for(let j=0;j<Doc.SLPD.SelectableElements.length, elem=Doc.SLPD.SelectableElements[j]; j++) {
					for(let k=0;k<elem.SnapRects.length; k++) {
						if(elem.SnapRects[k].intersects(IntersectRect)) {
							let computedStyle = top.getComputedStyle(elem, null),
								hidden = (computedStyle.getPropertyValue('visibility') == 'hidden' ||
											computedStyle.getPropertyValue('display') == 'none');

							if(!hidden) {
								if(elem.tagName == 'A' && SelectLargestFontSizeIntersectionLinks) {
									let fontSize = computedStyle.getPropertyValue("font-size");

									if(fontSize.indexOf("px") >= 0)
										elem.SnapFontSize = parseFloat(fontSize);

									if(elem.SnapIsJsLink) {
										if(elem.SnapFontSize > HighJsLinkFontSize)
											HighJsLinkFontSize = elem.SnapFontSize;
									}
									else {
										if(elem.SnapFontSize > HighLinkFontSize)
											HighLinkFontSize = elem.SnapFontSize;
									}
								}

								if(elem.tagName == 'INPUT') {
									switch(elem.getAttribute('type')) {
										case 'checkbox':
											TypeCounts.Checkboxes++;
											break;
										case 'radio':
											TypeCounts.RadioButtons++;
											break;
										case 'button':
										case 'submit':
											TypeCounts.Buttons++;
											break;
									}

								} else if(elem.tagName == 'A') {
									if(elem.SnapIsJsLink)
										TypeCounts.JsLinks++;
									else
										TypeCounts.Links++;
								} else if(elem.SnapLinksClickable == true) {
									TypeCounts.Clickable++;
								}

								IntersectedElements.push(elem);
							}
							break;	/* Breaks from elem.SnapRects[k] */
						}
					}
				}
			}
			dc('calc-elements', 'IntersectedElements = %o, TypeCounts = %o', IntersectedElements, TypeCounts);

			// Init the greatest values with the first item.
			let Greatest = TypesInPriorityOrder[0],
				GreatestValue = TypeCounts[Greatest];

			// Check if any of the other values if greater.
			for (let i = 1; i < TypesInPriorityOrder.length; ++i) {
				let key = TypesInPriorityOrder[i];

				if (TypeCounts[key] > GreatestValue) {
					Greatest = key;
					GreatestValue = TypeCounts[key];
				}
			}

			// Choose the filter function.
			let filterFunction;

			switch(Greatest) {
				case 'Links':
					filterFunction = function(elem) { return elem.tagName == 'A' && !elem.SnapIsJsLink && (!SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == (this.SelectedFixedFontSize || HighLinkFontSize)); };
					break;
				case 'JsLinks':
					filterFunction = function(elem) { return elem.tagName == 'A' && elem.SnapIsJsLink && (!SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == (this.SelectedFixedFontSize || HighJsLinkFontSize)); };
					break;
				case 'Checkboxes':
					filterFunction = function(elem) { return elem.tagName == 'INPUT' && elem.getAttribute('type') == 'checkbox'; };
					break;
				case 'Buttons':
					filterFunction = function(elem) { return elem.tagName == 'INPUT' && (elem.getAttribute('type') == 'button' || elem.getAttribute('type') == 'submit'); };
					break;
				case 'RadioButtons':
					filterFunction = function(elem) { return elem.tagName == 'INPUT' && elem.getAttribute('type') == 'radio'; };
					break;
				case 'Clickable':
					filterFunction = function(elem) { return elem.SnapLinksClickable; };
					break;
			}

			// Filter the elements.
			let SelectedElements = IntersectedElements.filter(filterFunction, this);

			dc('calc-elements', 'AfterFilter: Greatest=%s, SelectedElements = %o', Greatest, SelectedElements);

//			if(Greatest == 'Links' && SLPrefs.Elements.Anchors.RemoveDuplicateUrls) {
//				/* Detect duplicate links by filtering links which are contained fully within other links - Issue #37
//				 * 	Note: Identical links are allowed through here. */
//				var Urls = this.SelectedElements.map(function(elem) { return elem.href; } );
//				Urls = Urls.filter(function(outerUrl, outerIndex) {
//					return !Urls.some(function(innerUrl, innerIndex) {
//						if(innerIndex == outerIndex || innerUrl == outerUrl)
//							return false;
//						return outerUrl.indexOf(innerUrl) != -1;
//					} );
//				} );
//				dc('temp', '%o', Urls);
//				/* Identical links are filtered here */
//				var Allowed = [ ];
//				this.SelectedElements = this.SelectedElements.filter( function(elem) {
//					if(Allowed.indexOf(elem.href) != -1)
//						return false;
//
//					if(Urls.indexOf(elem.href) != -1) {
//						Allowed.push(elem.href);
//						return true;
//					}
//					return false;
//				} );
//			}

			let OutlineStyle = SLPrefs.SelectedElements.BorderWidth + 'px solid ' + SLPrefs.SelectedElements.BorderColor;

			if(this.SelectedElements) {
				let PreviousElements = this.SelectedElements,
					NewElements = [ elem for each ( elem in SelectedElements ) if (PreviousElements.indexOf(elem) == -1) ],
					ClearElements = [ elem for each ( elem in PreviousElements ) if (SelectedElements.indexOf(elem) == -1) ];

				// Set the outline on NewElements
				this.SetOutline(NewElements, OutlineStyle);

				// Clear the style on ClearElements
				this.SetOutline(ClearElements, '');
			} else {
				this.SetOutline(SelectedElements, OutlineStyle);
			}

			this.SelectedElementsType = Greatest;

			this.SelectedCountsLabel = [SelectedElements.length];
			this.SelectedElements = SelectedElements;
		}
		dc('calc-elements', 'Final: SelectedElements = %o', this.SelectedElements);
		return SLPrefs.Selection.MinimumCalcDelay;	/* Updates Frequency from CapCallFrequency */
	},

//|																																																																																																																																	*/
//|	  Cleanup Functions																																																																																																																												*/
//|																																																																																																																																	*/

	/** Clears the selection by removing the element, also clears some other non-refactored but moved code, basically completing a drag */
	Clear: function() {
		this.ClearSelectedElements();
		this.SelectedCountsLabel = '';

		/* Delete our outline element and floating count element */
		this.XulOutlineElem = undefined;
		this.XulCountElem = undefined;

		/* Delete our data store SLPD from each document */
		for(let URL in this.Documents) {
			this.Documents[URL].SLPD.MutationObserver.disconnect();
			delete this.Documents[URL].SLPD.MutationObserver;
			delete this.Documents[URL].SLPD.CalculateSelectable;
			delete this.Documents[URL].SLPD;
		}
		delete this.Documents;
		this.ShiftDown = false;

		/* No longer need to reference these */
		delete this.SelectedFixedFontSize;
	},

	/* Clears the selection style from the currently selected elements or from elements belonging to Doc */
	ClearSelectedElements: function(Doc) {
		if(this.SelectedElements) {
			let Elements = this.SelectedElements;
			if(Doc) {
				/* Sort all elements into Elements (for this doc) and all the rest */
				[ Elements, this.SelectedElements ] = this.SelectedElements.reduce(function(acc, elem) {
					acc[(elem.ownerDocument.URL != Doc.URL) << 0].push(elem);
					return acc;
				}, [ [ ], [ ] ]);
			} else {
				delete this.SelectedElements;
			}
			this.SetOutline(Elements, '');
		}
	},

//|																																																																																																																																	*/
//|	  Floating Status Indicator Functions																																																																																																																												*/
//|																																																																																																																																	*/

	/* Updates the visible position of the element */
	UpdateElement: function() {
		let pbo = this.XulOutlineElem.parentNode.boxObject,				/* Parent Box Object */
			sbw = this.TabBrowser.selectedBrowser.contentWindow;		/* Selected Browser Window */

		/* Maximum values for final top/left/height/width of Element dimensions */
		let BoundingRect = this.FixedBrowserRect;

		let OffsetSelectionRect = this.SelectionRect.clone()							/* SelectionRect is in document coordinates */
									.Offset(-this.top.scrollX, -this.top.scrollY) 		/* Offset to non-scrolled coordinates */
									.scale(this.PixelScale, 	this.PixelScale)		/* Convert from document zoom scale to UI scale */
									.Offset(pbo.x, pbo.y);								/* Offset by chrome top bar coordinates */

		let ClippedRect = OffsetSelectionRect.intersect(BoundingRect);

		ApplyStyle(this.XulOutlineElem, {
			left 	: ClippedRect.left + 'px',
			top 	: ClippedRect.top + 'px',
			width 	: ClippedRect.width + 'px',
			height 	: ClippedRect.height  + 'px',

			/* Border width is dependent on not being at the bounding edge unless the document is scrolled entirely in that direction */
			borderTopWidth		: ( ClippedRect.top 	== BoundingRect.top 	&& sbw.scrollY > 0 )				? '0px' : SLPrefs.Selection.BorderWidth+'px',
			borderBottomWidth	: ( ClippedRect.bottom 	== BoundingRect.bottom 	&& sbw.scrollY < sbw.scrollMaxY ) 	? '0px' : SLPrefs.Selection.BorderWidth+'px',
			borderLeftWidth		: ( ClippedRect.left 	== BoundingRect.left 	&& sbw.scrollX > 0 )				? '0px' : SLPrefs.Selection.BorderWidth+'px',
			borderRightWidth	: ( ClippedRect.right 	== BoundingRect.right 	&& sbw.scrollX < sbw.scrollMaxX )	? '0px' : SLPrefs.Selection.BorderWidth+'px',
		});

		this.HideSelectionRect(!(this.SelectionRect.width > 4 || this.SelectionRect.height > 4));

		this.RepositionElementCount();

		this.CalcSelectedElements();
	},

	RepositionElementCount: function() {
		if(this.XulCountElem && this.XulCountElem.style.display != 'none') {
			let Margin = 6;

			let CountRect = new Rect(this.XulCountElem.getBoundingClientRect()),
				SelectRect = new Rect(this.XulOutlineElem.getBoundingClientRect()),
				BrowserRect = this.FixedBrowserRect;

			let x = this.SelectionRect.IsInvertedX ? SelectRect.left - CountRect.width - Margin : SelectRect.right + Margin,
				y = (this.SelectionRect.IsInvertedY ? SelectRect.top : SelectRect.bottom) - CountRect.height - Margin;

			CountRect.Offset(-CountRect.left, -CountRect.top);		/* Move to 0,0 coordinates */
			CountRect.Offset(x, y);									/* Move to Left or Right and Above Cursor,

			/* Prefer outside of rect, but flip inside if outside the BrowserRect left|right */
			if(CountRect.right > BrowserRect.right)
				CountRect.Offset(-(CountRect.width + (Margin * 2)), 0);
			else if (CountRect.left < BrowserRect.left)
				CountRect.Offset((CountRect.width + (Margin * 2)), 0);

			if(CountRect.top < BrowserRect.top)
				CountRect.Offset(0, (CountRect.height + (Margin * 2)));

			ApplyStyle(this.XulCountElem, {
				top: CountRect.top + 'px',
				left: CountRect.left + 'px'
			});
		}
	},

//|																																																																																																																																	*/
//|	  Miscellaneous																																																																																																																												*/
//|																																																																																																																																	*/

	SetOutline: function(Elements, OutlineStyle) {
		let	elem, elem2;
		for(let j=0;j<Elements.length, elem=Elements[j]; j++) {
			for(let k=0;k<elem.SnapOutlines.length, elem2=elem.SnapOutlines[k];k++)
				elem2.style.outline = OutlineStyle;
		}
	},
	/** Hides or shows the selection rect and accompanying elements/text */
	HideSelectionRect: function(Hide) {
		if(Hide && this.XulOutlineElem.style.display != 'none') {
			this.ClearSelectedElements();
			this.XulOutlineElem.style.display = 'none';
			this.XulCountElem && (this.XulCountElem.style.display = 'none');
			this.SelectedCountsLabel = '';
		} else if(!Hide && this.XulOutlineElem.style.display == 'none') {
			this.XulOutlineElem.style.display = '';
			this.XulCountElem && (this.XulCountElem.style.display = '');
		}
	},
} );
