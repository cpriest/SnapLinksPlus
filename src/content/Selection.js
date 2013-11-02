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

/* 	@MARK - Things are looking pretty good
		@TODO - Letting up on right-click doesn't function properly any longer
		@TODO Change positioning to be based on mozMovementX/Y or SelectionRect is stored in screen coordinates and translated to whatever coordinates we need at the time of use
			- document.defaultView.mozInnerScreenX/Y seems to be The TopLeft of the sub-document in screen coordinates (even if off screen/monitor)
			\ This would let us avoid "having" to index documents and get the top/left position of the sub-document because each document has screen coordinates
		@TODO - Dragging over the console messes with the rect
																																																																																																															*  */


var EXPORTED_SYMBOLS = ["SnapLinksSelectionClass"];

var Cu = Components.utils,
	Cc = Components.classes,
	Ci = Components.interfaces;

try {
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

	/* Dynamic Window */
	set Window(v) {
		if(this._Window = v)
			dc('doctree', DumpWindowFrameStructure.bind(DumpWindowFrameStructure, this._Window));
	},
	get Window() { return this._Window; },


	/* Dynamic TopDocument */
	get TopDocument() { return this.Window.document;},

	/* Dynamic TopDocument.documentElement */
	get TopDocumentElement() { return (this.TopDocument && this.TopDocument.documentElement) || undefined; },

	/* All document/element based values are stored within the document so that if the document dies,
		our elements are simply gone as well, this handles the DeadObject issue well */
	get SLP() {
		if(!this.TopDocument.SLP)
			this.TopDocument.SLP = { };
		return this.TopDocument.SLP;
	},


	/* Dynamic creation/deletion of Element */
	get Element() {
		if(!this._Element) {
			let InsertionNode = this.SnapLinksPlus.ChromeWindow.document.getElementById('content');
			let Element = CreateAnonymousElement('<box></box>');
			if(InsertionNode && Element) {
				ApplyStyle(Element, {
					color        : SLPrefs.Selection.BorderColor,
					border       : SLPrefs.Selection.BorderWidth + 'px dotted',

					display      : 'none',
					position     : 'fixed',
					zIndex       : '999999',
					pointerEvents: 'none',
				});
				InsertionNode.insertBefore(Element, InsertionNode.firstChild);
				this._Element = Element;
			}
		}
		return this._Element;
	},
	set Element(x) {
		if(x == undefined && this._Element)
			try { this._Element.parentNode.removeChild(this._Element); } catch(e) { }
		this._Element = x;
	},


	/* Dynamic creation/deletion of ElementCount */
	get ElementCount() {
		if(!this._ElementCount && SLPrefs.Selection.ShowCount && SLPrefs.Selection.ShowCountWhere == SLE.ShowCount_Hover) {
			let InsertionNode = this.Element.parentNode;
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
				InsertionNode.insertBefore(ElementCount, this.Element.nextSibling);
				this._ElementCount = ElementCount;
			}

			if(SLPrefs.Selection.ShowCount)
				this.SelectedStatusLabel = this.SnapLinksPlus.LocaleBundle.formatStringFromName("snaplinks.status.links", ['0'], 1);
		}
		return this._ElementCount;
	},
	set ElementCount(x) {
		if(x == undefined && this._ElementCount)
			try { this._ElementCount.parentNode.removeChild(this._ElementCount); } catch(e) { }
		this._ElementCount = x;
	},

	set SelectedStatusLabel(label) {
		this.SnapLinksPlus.SnapLinksStatus = label;

		if (this.ElementCount) {
			// Remove the existing child elements.
			while (this.ElementCount.firstChild)
				this.ElementCount.removeChild(this.ElementCount.firstChild);

			// Add the links count.
			var linksElem = this.Window.document.createTextNode(label);
			this.ElementCount.appendChild(linksElem);
		}
	},

	/* Rect coordinates of "browser pane" in fixed coordinates of ChromeWindow, adjusted for scroll bar */
	get FixedBrowserRect() {
		let ParentBoxObject = this.Element.parentNode.boxObject;

		try {
			return new Rect( ParentBoxObject.y, ParentBoxObject.x,
				/* bottom */	ParentBoxObject.y + ParentBoxObject.height - (this.TopDocument && this.TopDocument.documentElement.scrollLeftMax != 0 ? 16 : 0),	/* ScrollBar Adjustment */
				/* right */		ParentBoxObject.x + ParentBoxObject.width  - (this.TopDocument && this.TopDocument.documentElement.scrollTopMax != 0 ? 16 : 0));	/* ScrollBar Adjustment */
		} catch(e) {
			return new Rect(0, 0, 0, 0);
		}
	},


	/* Dynamically re-calculated Indexed Documents */
	get Documents() {
		if(!this.SLP.Documents || !this.SLP.Documents[this.TopDocument.URL])
			this.SLP.Documents = this.IndexDocuments(this.TopDocument);
		return this.SLP.Documents;
	},
	set Documents(x) { this.SLP.Documents = x; },


	/* Dynamic creation of elementm, stored in document */
	get SelectedElements() {
		if(!this.SLP.SelectedElements)
			this.SLP.SelectedElements = [ ];
		return this.SLP.SelectedElements;
	},
	set SelectedElements(x) { this.SLP.SelectedElements = x },

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
	get DragStarted() { return this.Element.style.display != 'none'; },

	get XulDocument() { return this.SnapLinksPlus.XulDocument; },
	get ChromeWindow() { return this.SnapLinksPlus.ChromeWindow; },
	get PanelContainer() { return this.SnapLinksPlus.PanelContainer; },

	initialize: function(SnapLinksPlus) {
		this.SnapLinksPlus = SnapLinksPlus;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), true);

		this._OnMouseMove 			= this.OnMouseMove.bind(this);
		this._OnMouseUp 			= this.OnMouseUp.bind(this);
		this._OnDocumentUnloaded	= this.OnDocumentUnloaded.bind(this);
		this._OnDocumentLoaded		= this.OnDocumentLoaded.bind(this);

		/* Set mock object for use until first event determines our window */
		this._Window = { document: { } };
	},

	/* Index all documents by URL and calculate offset from Top Document */
	IndexDocuments: function IndexDocuments(TopDocument) {
		var Documents = { };

		/* Insert top document */
		Documents[TopDocument.URL] = {
			Document: 	TopDocument,
			height:		MaxDocValue(TopDocument, 'scrollHeight'),
			width:		MaxDocValue(TopDocument, 'scrollWidth'),
			offset: 	{x: 0, y: 0}
		};

		function IndexFrames(frames) {
			for(let j=0; j < frames.length;j++) {
				let frame = frames[j],
					elem = frame.frameElement,
					offset = { x: 0, y: 0 };

				/* Unusual case where a sub-frame has the same URL as the TopDocument, skipping this frame in this case, see this page for issue: https://groups.google.com/forum/#!msg/snaplinksplus/7a18LX7n6uM/5A39Mdlx5RQJ */
				if(frame.document.URL == TopDocument.URL)
					continue;

				do {
					offset.x += elem.offsetLeft;
					offset.y += elem.offsetTop;
					elem = elem.offsetParent;
				} while(elem != null);
				offset.x += Documents[frame.parent.document.URL].offset.x;
				offset.y += Documents[frame.parent.document.URL].offset.y;
				Documents[frame.document.URL] = {
					Document: 	frame.document,
					height:		MaxDocValue(frame.document, 'scrollHeight'),
					width:		MaxDocValue(frame.document, 'scrollWidth'),
					offset: 	offset
				};
				IndexFrames(frame);
			}
		}
		IndexFrames(TopDocument.defaultView.frames);
		dc('doc-index', '%o', Documents);

		return Documents;
	},

	/* Starting Hook for beginning a selection */
	OnMouseDown: function(e) {
		this.Window = e.view.top;
		if(!this.SnapLinksPlus.ShouldActivate(e))
			return;

		var Document = e.target.ownerDocument;

		/** Initializes the starting mouse position */
		this.SelectionRect = new Rect(e.pageY, e.pageX);

		/* If we aren't starting in the top document, change rect coordinates to top document origin */
		if(Document != this.TopDocument) {
			this.SelectionRect.Offset(-MaxDocValue(Document, 'scrollLeft'), -MaxDocValue(Document, 'scrollTop'));
			this.SelectionRect.Offset(this.Documents[Document.URL].offset.x, this.Documents[Document.URL].offset.y);
		}

		if(e.target && e.target.tagName == 'A') {
			var computedStyle = e.target.ownerDocument.defaultView.getComputedStyle(e.target, null);
			this.SelectedFixedFontSize = parseFloat(computedStyle.getPropertyValue("font-size"));
		}

		this.InstallEventHooks();
	},

	InstallEventHooks: function() {
		this.ChromeWindow.addEventListener('mousemove', this._OnMouseMove, true);
		this.ChromeWindow.addEventListener('mouseup', this._OnMouseUp, true);
		this.PanelContainer.addEventListener('load', this._OnDocumentLoaded, true);
		this.PanelContainer.addEventListener('unload', this._OnDocumentUnloaded, true);
	},
	RemoveEventHooks: function() {
		this.ChromeWindow.removeEventListener('mousemove', this._OnMouseMove, true);
		this.ChromeWindow.removeEventListener('mouseup', this._OnMouseUp, true);
		this.PanelContainer.removeEventListener('load', this._OnDocumentLoaded, true);
		this.PanelContainer.removeEventListener('unload', this._OnDocumentUnloaded, true);
	},

	OnMouseMove: function(e) {
//		console.log('page (%d,%d), screen(%d,%d), move(%d, %d), %o, e.target=%o', e.pageX, e.pageY, e.screenX, e.screenY, e.mozMovementX, e.mozMovementY, e, e.target);
		this.CalculateSnapRects(e.target.ownerDocument);

		/* If we have an offscreen scroll interval set, clear it */
		clearTimeout(this.ScrollInterval);

		this.SelectLargestFontSizeIntersectionLinks = !e.shiftKey;

		var pageX = e.pageX,
			pageY = e.pageY;

		/* If we are in a sub-document, offset our coordinates by the top/left of that sub-document element (IFRAME) */
		if(e.target.ownerDocument != this.TopDocument) {
			if(e.target.ownerDocument && this.Documents[e.target.ownerDocument.URL]) {
				pageX += this.Documents[e.target.ownerDocument.URL].offset.x - MaxDocValue(e.target.ownerDocument, 'scrollLeft');
				pageY += this.Documents[e.target.ownerDocument.URL].offset.y - MaxDocValue(e.target.ownerDocument, 'scrollTop');
			} else if(e.target == this.Element.ownerDocument || e.target.ownerDocument == this.Element.ownerDocument) {
				pageX += MaxDocValue(this.TopDocument, 'scrollLeft') - this.Element.parentNode.boxObject.x;
				pageY += MaxDocValue(this.TopDocument, 'scrollTop') - this.Element.parentNode.boxObject.y;
			}
		}

		var clientX = pageX - MaxDocValue(this.TopDocument, 'scrollLeft'),
			clientY = pageY - MaxDocValue(this.TopDocument, 'scrollTop');

//		console.log('HideOnMouseLeave: %s, Page: [%d, %d], Client: [%d, %d], winInner: [%d, %d], %o, %o', SLPrefs.Selection.HideOnMouseLeave, pageX, pageY, clientX, clientY, this.TopDocument.defaultView.innerWidth, this.TopDocument.defaultView.innerHeight, e, this.TopDocument);

		if(clientX < 0 || clientY < 0 || clientX > this.TopDocument.defaultView.innerWidth || clientY > this.TopDocument.defaultView.innerHeight) {
			if(SLPrefs.Selection.HideOnMouseLeave) {
				this.HideSelectionRect(true);
				return;
			} else {
				let offsetX = 0, offsetY = 0;

				if(clientX < 0)
					offsetX = clientX;
				else if(clientX > this.TopDocument.defaultView.innerWidth)
					offsetX = clientX - this.TopDocument.defaultView.innerWidth;

				if(clientY < 0)
					offsetY = clientY;
				else if(clientY > this.TopDocument.defaultView.innerHeight)
					offsetY = clientY - this.TopDocument.defaultView.innerHeight;

				/* Scroll TopDocument Window */
				this.Window.scrollBy(offsetX, offsetY);

				/* Scroll TopDocument every N time period, even on no mouse move basically by repeating this same mousemove event */
				this.ScrollInterval = setInterval(this.OnMouseMove.bind(this, e), 25);
			}
		} else if(this.Element.style.display == 'none')
			this.HideSelectionRect(false);

		/* Disabled At The Moment */
		if(false && e.altKey && !SLPrefs.Activation.RequiresAlt) {
			this.OffsetSelection(pageX - this.SelectionRect.right, pageY - this.SelectionRect.bottom);
		} else {
			this.ExpandSelectionTo(pageX, pageY);
		}
	},

	OnMouseUp: function(e) {
		clearTimeout(this.ScrollInterval);
		this.RemoveEventHooks();
	},

	OnDocumentLoaded: function(e) {
//		console.log('loaded: %s, %s, %o %o', e.target.URL, this.Window.document.URL, e, this.Window);
		if(e.target.URL == this.Window.document.URL) {
//			console.log('loaded top document');
			setTimeout(function() {
				this.CalculateAllDocumentSnapRects();
				this.UpdateElement();
				this.ChromeWindow.addEventListener('mousemove', this._OnMouseMove, true);
			}.bind(this), 0);
		}
	},
	OnDocumentUnloaded: function(e) {
//		console.log('unloaded: %s, %s, %o %o', e.target.URL, this.Window.document.URL, e, this.Window);
		if(e.target.URL == this.Window.document.URL) {
//			console.log('unloaded top document');
			this.ChromeWindow.removeEventListener('mousemove', this._OnMouseMove, true);
		}
	},

	CalculateAllDocumentSnapRects: function() {
		for(var URL in this.Documents)
			this.CalculateSnapRects(this.Documents[URL].Document);
	},

	/** Calculates and caches the rectangles that make up all document lengths */
	CalculateSnapRects: function(Document) {
		if(!Document || !this.Documents[Document.URL])
			return;

		/* If the last calculation was done at the same innerWidth, skip calculation */
		if(this.CalculateWindowWidth == this.Window.innerWidth && this.Documents[Document.URL].SelectableElements != undefined)
			return;

		this.CalculateWindowWidth = this.Window.innerWidth;

		var offset = { x: Document.defaultView.scrollX, y: Document.defaultView.scrollY };
		var SelectableElements = [ ];

		var Start = (new Date()).getTime();

		$A(Document.links).forEach( function( link ) {
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

		$A(Document.body.querySelectorAll('INPUT')).forEach( function(input) {
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

		$A(Document.body.querySelectorAll('LABEL')).forEach( function(label) {
			var forId = label.getAttribute('for');
			if (forId != null && forId != '') {
				var ForElement;

				try {
					ForElement = Document.body.querySelector('INPUT[type=checkbox]#'+forId);
				} catch(e) {
					// If querySelector() fails, the ID is propably illegal.
					// We can still find the elemement by using getElementById().
					var idElem = Document.getElementById(forId);
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
		var AnchoredElems = $A(Document.body.querySelectorAll('A[href] IMG, A[href] SPAN, A[href] DIV'));

		$A(Document.body.querySelectorAll('IMG, SPAN, DIV'))
			.filter( function(elem) { return AnchoredElems.indexOf(elem) == -1; })
			.forEach( function(elem) {
				if(elem.SnapLinksClickable || elem.ownerDocument.defaultView.getComputedStyle(elem).cursor == 'pointer') {
					elem.SnapLinksClickable = true;
					elem.SnapRects = GetElementRects(elem, offset);
					elem.SnapOutlines = [ elem ];
					SelectableElements.push(elem);
				}
			});

		this.Documents[Document.URL].SelectableElements = SelectableElements;

		var End = (new Date()).getTime();
		dc('performance', "CalculateSnapRects() -> Links: %sms, Inputs: %sms, Labels: %sms, Clickable: %sms, Total: %sms",
			Links - Start, Inputs - Links, Labels - Inputs, End - Labels, End - Start);
	},

	/** Clears the selection by removing the element, also clears some other non-refactored but moved code, basically completing a drag */
	Clear: function() {
		this.ClearSelectedElements();
		this.SelectedStatusLabel = '';
		this.Element = undefined;
		this.ElementCount = undefined;
		this.Documents = undefined;
		delete this.CalculateWindowWidth;

		this.SelectLargestFontSizeIntersectionLinks = true;

		/* No longer need to reference these */
		delete this.SelectedFixedFontSize;
	},

	/* Clears the selection style from the currently selected elements */
	ClearSelectedElements: function() {
		this.SetOutline(this.SelectedElements, '');

		this.SelectedElements = [ ];
	},

	/** Offsets the selection by the given coordinates */
	OffsetSelection: function(X, Y) {
		this.SelectionRect.Offset(X, Y);
		this.UpdateElement();
	},

	/* Expands the selection to the given X, Y coordinates */
	ExpandSelectionTo: function(X, Y) {
		this.SelectionRect.right = Math.max(0, Math.min(X, this.Documents[this.TopDocument.URL].width));
		this.SelectionRect.bottom = Math.max(0, Math.min(Y, this.Documents[this.TopDocument.URL].height));
		this.UpdateElement();
	},

	/* Updates the visible position of the element */
	UpdateElement: function() {
		let ParentBoxObject = this.Element.parentNode.boxObject;

		/* Maximum values for final top/left/height/width of Element dimensions */
		let BoundingRect = this.FixedBrowserRect;

		let OffsetSelectionRect = this.SelectionRect.clone()																			/* SelectionRect is in document coordinates */
									.Offset(-MaxDocValue(this.TopDocument, 'scrollLeft'), -MaxDocValue(this.TopDocument, 'scrollTop')) 	/* Offset to non-scrolled coordinates */
									.Offset(ParentBoxObject.x, ParentBoxObject.y);														/* Offset by chrome top bar coordinates */

		let ClippedRect = OffsetSelectionRect.intersect(BoundingRect);

		ApplyStyle(this.Element, {
			left 	: ClippedRect.left + 'px',
			top 	: ClippedRect.top + 'px',
			width 	: ClippedRect.width + 'px',		/*- (2 * SLPrefs.Selection.BorderWidth)*/
			height 	: ClippedRect.height  + 'px',	/*- (2 * SLPrefs.Selection.BorderWidth)*/

			/* Border width is dependent on not being at the bounding edge unless the document is scrolled entirely in that direction */
			borderTopWidth		: ( ClippedRect.top 	== BoundingRect.top 	&& this.TopDocumentElement.scrollTop > 0 )	? '0px' : '',
			borderBottomWidth	: ( ClippedRect.bottom 	== BoundingRect.bottom 	&& this.TopDocumentElement.scrollTop < this.TopDocumentElement.scrollTopMax ) 	? '0px' : '',
			borderLeftWidth		: ( ClippedRect.left 	== BoundingRect.left 	&& this.TopDocumentElement.scrollLeft > 0 )	? '0px' : '',
			borderRightWidth	: ( ClippedRect.right 	== BoundingRect.right 	&& this.TopDocumentElement.scrollLeft < this.TopDocumentElement.scrollLeftMax )	? '0px' : '',
		});

		this.HideSelectionRect(!(this.SelectionRect.width > 4 || this.SelectionRect.height > 4));

		this.RepositionElementCount();

		this.CalcSelectedElements();
	},

	RepositionElementCount: function() {
		if(this.ElementCount && this.ElementCount.style.display != 'none') {
			let Margin = 6;

			let CountRect = new Rect(this.ElementCount.getBoundingClientRect()),
				SelectRect = new Rect(this.Element.getBoundingClientRect()),
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

			ApplyStyle(this.ElementCount, {
				top: CountRect.top + 'px',
				left: CountRect.left + 'px'
			});
		}
	},

	/* Calculates which elements intersect with the selection */
	CalcSelectedElements: function() {
		if(this.Element.style.display != 'none') {
			var HighLinkFontSize = 0;
			var HighJsLinkFontSize = 0;
			let IntersectedElements = [ ];

			var TypesInPriorityOrder = ['Links', 'JsLinks', 'Checkboxes', 'Buttons', 'RadioButtons', 'Clickable'];
			var TypeCounts = {'Links': 0, 'JsLinks': 0, 'Checkboxes': 0, 'Buttons': 0, 'RadioButtons': 0, Clickable: 0};

			for(var URL in this.Documents) {
				//noinspection JSUnfilteredForInLoop
				var ti = this.Documents[URL];
				var DocRect;

				/* If we are the top document. use documents height/width, otherwise use sub-documents viewport height/width */
				if(ti.offset.x == 0 && ti.offset.y == 0)
					DocRect = new Rect(0, 0, ti.height, ti.width);
				else
					DocRect = new Rect(0, 0, ti.Document.defaultView.innerHeight, ti.Document.defaultView.innerWidth)
						.Offset(ti.offset.x, ti.offset.y);

				var IntersectRect = this.SelectionRect.GetIntersectRect(DocRect);

				/* If we have no SelectRect then there is no intersection with ti.Document's coordinates */
				if(IntersectRect !== false) {
					/* If we're not in the top document, translate SelectRect to document coordinates */
					if(ti.Document != this.TopDocument) {
						IntersectRect.Offset(-ti.offset.x, -ti.offset.y);
						IntersectRect.Offset(MaxDocValue(ti.Document, 'scrollLeft'), MaxDocValue(ti.Document, 'scrollTop'));
					}

					let elem;
					dc('calc-elements', '%o.SelectableElements = %o', ti, ti.SelectableElements);
					/* Find Links Which Intersect With SelectRect */
					for(let j=0;j<ti.SelectableElements.length, elem=ti.SelectableElements[j]; j++) {
						var Intersects = elem.SnapRects.some( IntersectRect.IntersectsWith.bind(IntersectRect) );

						if(Intersects) {
							var computedStyle = this.Window.content.document.defaultView.getComputedStyle(elem, null);
							var hidden = (computedStyle.getPropertyValue('visibility') == 'hidden' ||
								computedStyle.getPropertyValue('display') == 'none');

							if(!hidden) {
								if(elem.tagName == 'A' && this.SelectLargestFontSizeIntersectionLinks) {
									var fontSize = computedStyle.getPropertyValue("font-size");

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
						}
					}
				}
			}
			dc('calc-elements', 'IntersectedElements = %o, TypeCounts = %o', IntersectedElements, TypeCounts);

			// Init the greatest values with the first item.
			var Greatest = TypesInPriorityOrder[0];
			var GreatestValue = TypeCounts[Greatest];

			// Check if any of the other values if greater.
			for (var i = 1; i < TypesInPriorityOrder.length; ++i) {
				var key = TypesInPriorityOrder[i];

				if (TypeCounts[key] > GreatestValue) {
					Greatest = key;
					GreatestValue = TypeCounts[key];
				}
			}

			// Choose the filter function.
			var filterFunction;

			switch(Greatest) {
				case 'Links':
					filterFunction = function(elem) { return elem.tagName == 'A' && !elem.SnapIsJsLink && (!this.SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == (this.SelectedFixedFontSize || HighLinkFontSize)); };
					break;
				case 'JsLinks':
					filterFunction = function(elem) { return elem.tagName == 'A' && elem.SnapIsJsLink && (!this.SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == (this.SelectedFixedFontSize || HighJsLinkFontSize)); };
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

			let PreviousElements = this.SelectedElements,
				NewElements = [ elem for each ( elem in SelectedElements ) if (PreviousElements.indexOf(elem) == -1) ],
				ClearElements = [ elem for each ( elem in PreviousElements ) if (SelectedElements.indexOf(elem) == -1) ];

			// Set the outline on NewElements
			this.SetOutline(NewElements, SLPrefs.SelectedElements.BorderWidth + 'px solid ' + SLPrefs.SelectedElements.BorderColor);

			// Clear the style on ClearElements
			this.SetOutline(ClearElements, '');

			this.SelectedElementsType = Greatest;

			this.SelectedStatusLabel = this.SnapLinksPlus.LocaleBundle.formatStringFromName("snaplinks.status.links", [SelectedElements.length], 1);
			this.SelectedElements = SelectedElements;
		}
		dc('calc-elements', 'Final: SelectedElements = %o', this.SelectedElements);
	},

	SetOutline: function(Elements, OutlineStyle) {
		let	elem, elem2;
		for(let j=0;j<Elements.length, elem=Elements[j]; j++) {
			for(let k=0;k<elem.SnapOutlines.length, elem2=elem.SnapOutlines[k];k++)
				elem2.style.outline = OutlineStyle;
		}
	},
	/** Hides or shows the selection rect and accompanying elements/text */
	HideSelectionRect: function(Hide) {
		if(Hide && this.Element.style.display != 'none') {
			this.ClearSelectedElements();
			this.Element.style.display = 'none';
			this.ElementCount && (this.ElementCount.style.display = 'none');
			this.SelectedStatusLabel = '';
		} else if(!Hide && this.Element.style.display == 'none') {
			this.Element.style.display = '';
			this.ElementCount && (this.ElementCount.style.display = '');
		}
	},
} );
