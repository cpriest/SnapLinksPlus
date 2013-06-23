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

var EXPORTED_SYMBOLS = ["SnapLinksSelectionClass"];

var Cu = Components.utils,
	Cc = Components.classes,
	Ci = Components.interfaces;

try {
	Cu.import("chrome://snaplinksplus/content/Utility.js");
	Cu.import("chrome://snaplinksplus/content/WindowFaker.js");
} catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

/** Selection class handles the selection rectangle and accompanying visible element */
var SnapLinksSelectionClass = Class.create({
	SnapLinksPlus: null,
	jsRegExp: /^javascript:/i,

	IntersectedElements: 	[ ],
	SelectedElements: 		[ ],

	/* Internal flag to control selecting all links or all links matching the greatest size */
	SelectLargestFontSizeIntersectionLinks:		true,

	/* Returns an array of elements representing the selected elements
	 *	taking into account preferences for removing duplicate urls 
	 */
	FilteredElements: {
		get: function() {
			if(this.SelectedElementsType != 'Links' &&
					this.SelectedElementsType != 'JsLinks') {
				return [ ];
			}

			var Distinct = [ ];
			return this.SelectedElements.filter( function(elem) {
				if(!elem.href || (this.SnapLinksPlus.Prefs.RemoveDuplicateUrls && Distinct.indexOf(elem.href) != -1))
					return false;
				Distinct.push(elem.href);
				return true;
			}, this);
		}
	},

	/* Internal Flag indicating that a selection has been started */
	DragStarted: false,

	initialize: function(SnapLinksPlus) {
		this.SnapLinksPlus = SnapLinksPlus;
		this.PanelContainer = this.SnapLinksPlus.PanelContainer;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), false);
		this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);

		this._OnMouseMove 	= this.OnMouseMove.bind(this);
		this._OnKeyDown		= this.OnKeyDown.bind(this);
		this._OnKeyUp		= this.OnKeyUp.bind(this);
	},

	/* Index all documents by URL and calculate offset from Top Document */
	IndexDocuments: function IndexDocuments(TopDocument) {
		var Documents = { };

		/* Insert top document */
		Documents[TopDocument.URL] = {
			Document: 	TopDocument,
			height:		Math.max(TopDocument.documentElement.scrollHeight, TopDocument.body.scrollHeight),
			width:		Math.max(TopDocument.documentElement.scrollWidth, TopDocument.body.scrollWidth),
			offset: 	{x: 0, y: 0}
		};

		function IndexFrames(frames) {
			for(let j=0; j < frames.length;j++) {
				let frame = frames[j];
				let elem = frame.frameElement;
				let offset = { x: 0, y: 0 };
				do {
					offset.x += elem.offsetLeft;
					offset.y += elem.offsetTop;
					elem = elem.offsetParent;
				} while(elem != null);
				offset.x += Documents[frame.parent.document.URL].offset.x;
				offset.y += Documents[frame.parent.document.URL].offset.y;
				Documents[frame.document.URL] = {
					Document: 	frame.document,
					height:		Math.max(frame.document.documentElement.scrollHeight, frame.document.body.scrollHeight),
					width:		Math.max(frame.document.documentElement.scrollWidth, frame.document.body.scrollWidth),
					offset: 	offset
				};
				IndexFrames(frame);
			}
		}
		IndexFrames(TopDocument.defaultView.frames);

		return Documents;
	},

	/* Starting Hook for beginning a selection */
	OnMouseDown: function(e) {
		this.Window = e.view.top;
		if(!this.SnapLinksPlus.ShouldActivate(e))
			return;

		var Document = e.target.ownerDocument;
		this.TopDocument = e.target.ownerDocument.defaultView.top.document;

		/** Initializes the starting mouse position */
		this.SelectionRect = new Rect(e.pageY, Math.min(e.pageX, Document.documentElement.offsetWidth + Document.defaultView.pageXOffset));

		this.Documents = this.IndexDocuments(this.TopDocument);
		dc('doctree', DumpWindowFrameStructure.bind(DumpWindowFrameStructure, this.Window));

		/* If we aren't starting in the top document, change rect coordinates to top document origin */
		if(Document != this.TopDocument) {
			this.SelectionRect.Offset(-Document.body.scrollLeft, -Document.body.scrollTop);
			this.SelectionRect.Offset(this.Documents[Document.URL].offset.x, this.Documents[Document.URL].offset.y);
		}

		if(e.target && e.target.tagName == 'A') {
			var computedStyle = e.target.ownerDocument.defaultView.getComputedStyle(e.target, null);
			this.SelectedFixedFontSize = parseFloat(computedStyle.getPropertyValue("font-size"));
		}

		this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
		this.PanelContainer.addEventListener('keydown', this._OnKeyDown, true);
		this.PanelContainer.addEventListener('keyup', this._OnKeyUp, true);
	},

	OnMouseMove: function(e) {
		this.CalculateSnapRects(e.target.ownerDocument);

		if(this.Element && e.target.ownerDocument == this.TopDocument) {
			if(e.clientX < 0 || e.clientY < 0 || e.clientX > this.TopDocument.defaultView.innerWidth || e.clientY > this.TopDocument.defaultView.innerHeight) {
				if(this.SnapLinksPlus.Prefs.HideSelectionOnMouseLeave)
					this.Element.style.display = 'none';
				else {
					this.Element.style.display = '';
					this.scrollOnViewEdge(e);
				}
			}
		}
		var pageX = e.pageX,
			pageY = e.pageY;

		/* If we are in a sub-document, offset our coordinates by the top/left of that sub-document element (IFRAME) */
		if(e.view.document != this.TopDocument) {
			pageX += this.Documents[e.view.document.URL].offset.x - e.target.ownerDocument.body.scrollLeft;
			pageY += this.Documents[e.view.document.URL].offset.y - e.target.ownerDocument.body.scrollTop;
		}

		/* Disabled At The Moment */
		if(false && e.altKey && !this.SnapLinksPlus.Prefs.ActivateRequiresAlt) {
			this.OffsetSelection(pageX - this.SelectionRect.right, pageY - this.SelectionRect.bottom);
		} else {
			this.ExpandSelectionTo(pageX, pageY);
		}

		if (this.ElementCount)
			this.RepositionElementCount(e);
	},

	OnMouseUp: function(e) {
		this.RemoveEventHooks();
	},

	OnKeyDown: function(e) {
		if(e.keyCode == this.Window.KeyboardEvent.DOM_VK_SHIFT ) {
			this.SelectLargestFontSizeIntersectionLinks = false;
			this.UpdateElement();
		}
	},

	OnKeyUp: function(e) {
		if(e.keyCode == this.Window.KeyboardEvent.DOM_VK_SHIFT ) {
			this.SelectLargestFontSizeIntersectionLinks = true;
			this.UpdateElement();
		}
	},

	/* Creates the selection rectangle element, returns true if element exists or was created successfully */
	Create: function() {
		if(this.DragStarted == true)
			return true;

		if(this.SelectionRect.width > 4 || this.SelectionRect.height > 4) {
			var InsertionNode = (this.TopDocument.documentElement) ? this.TopDocument.documentElement : this.TopDocument;

			this.Element = this.TopDocument.createElementNS('http://www.w3.org/1999/xhtml', 'snaplRect');
			if(InsertionNode && this.Element) {
				this.Element.style.color = this.SnapLinksPlus.Prefs.SelectionBorderColor;
				this.Element.style.border = this.SnapLinksPlus.Prefs.SelectionBorderWidth + 'px dotted';
				this.Element.style.position = 'absolute';
				this.Element.style.zIndex = '10000';
				this.Element.style.left = this.SelectionRect.left + 'px';
				this.Element.style.top = this.SelectionRect.top + 'px';
				InsertionNode.appendChild(this.Element);

				if(this.SnapLinksPlus.Prefs.ShowSelectedCount &&
						this.SnapLinksPlus.Prefs.ShowCountWhere == this.SnapLinksPlus.Prefs.ShowCount_Hover) {
					this.ElementCount = this.TopDocument.createElementNS('http://www.w3.org/1999/xhtml', 'div');
					ApplyStyle(this.ElementCount, {
						position		: 'absolute',
						padding			: '2px 4px',
						font			: '12px Verdana',
						zIndex			: '10000',
						border			: '1px solid black',
						backgroundColor	: '#FFFFCC'
					} );
					InsertionNode.appendChild(this.ElementCount);
				}

				this.DragStarted = this.Element.parentNode != undefined;

				if(this.DragStarted) {
					if(this.SnapLinksPlus.Prefs.ShowSelectedCount) {
						var linksText = this.SnapLinksPlus.LocaleBundle.formatStringFromName("snaplinks.status.links", ['0'], 1);
						this.SnapLinksPlus.SnapLinksStatus = linksText;
					}

					return true;
				}
			}
		}
		return false;
	},

	/** Calculates and caches the rectangles that make up all document lengths */
	CalculateSnapRects: function(Document) {
		if(!this.Documents[Document.URL])
			this.Documents[Document.URL] = { Document: Document };

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
						!this.SnapLinksPlus.Prefs.HighlightJsLinksForClicking) {
					return;
				}
			} catch (e) {
				Components.utils.reportError(e);
			}

			link.SnapRects = GetElementRects(link, offset);
			delete link.SnapFontSize;
			SelectableElements.push(link);
		}, this);

		var Links = (new Date()).getTime();

		$A(Document.body.querySelectorAll('INPUT')).forEach( function(input) {
			var Type = input.getAttribute('type'),
				ElementRectsNode = input;
			if(this.SnapLinksPlus.Prefs.HighlightButtonsForClicking && (Type == 'submit' || Type == 'button')) {
				SelectableElements.push(input);
			}
			if(this.SnapLinksPlus.Prefs.HighlightRadioButtonsForClicking && Type == 'radio') {
				SelectableElements.push(input);
			}
			else if(this.SnapLinksPlus.Prefs.HighlightCheckboxesForClicking && Type == 'checkbox') {
				if(input.parentNode.tagName == 'LABEL') {
					ElementRectsNode = input.parentNode;
					input.SnapOutlines = [ input.parentNode ];
				}
				SelectableElements.push(input);
			}
			input.SnapRects = GetElementRects(ElementRectsNode, offset);
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
					SelectableElements.push(elem);
				}
			});

		this.Documents[Document.URL].SelectableElements = SelectableElements;

		var End = (new Date()).getTime();
		dc('performance', "CalculateSnapRects() -> Links: %sms, Inputs: %sms, Labels: %sms, Clickable: %sms, Total: %sms",
			Links - Start, Inputs - Links, Labels - Inputs, End - Labels, End - Start);
	},

	/** Clears the selection by removing the element, also clears some other non-refactored but moved code */
	Clear: function() {
		if (this.Element)
			this.Element.parentNode.removeChild(this.Element);
		delete this.Element;

		if(this.ElementCount && this.ElementCount.parentNode)
			this.ElementCount.parentNode.removeChild(this.ElementCount);
		delete this.ElementCount;

		this.ClearSelectedElements();

		this.DragStarted = false;
		this.SelectLargestFontSizeIntersectionLinks = true;
		this.RemoveEventHooks();

		/* No longer need to reference these */
		delete this.Documents;
		delete this.CalculateWindowWidth;
		delete this.SelectedFixedFontSize;
	},
	/* Clears the selection style from the currently selected elements */
	ClearSelectedElements: function() {
		this.IntersectedElements = [ ];

		this.SelectedElements.forEach( function(elem) {
			(elem.SnapOutlines || [ elem ]).forEach( function(elem) {
				elem.style.MozOutline = '';	/* Pre FF13 */
				elem.style.outline = '';
			}, this );
		}, this );
		this.SelectedElements = [ ];
	},

	RemoveEventHooks: function() {
		this.PanelContainer.removeEventListener('keydown', this._OnKeyDown, true);
		this.PanelContainer.removeEventListener('keyup', this._OnKeyUp, true);
		this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
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
		if(this.Create()) {
			ApplyStyle(this.Element, {
				left 	: this.SelectionRect.left + 'px',
				top 	: this.SelectionRect.top + 'px',
				width 	: this.SelectionRect.width - (2 * this.SnapLinksPlus.Prefs.SelectionBorderWidth) + 'px',
				height 	: this.SelectionRect.height - (2 * this.SnapLinksPlus.Prefs.SelectionBorderWidth) + 'px'
			} );

			this.CalcSelectedElements();
		}
	},

	RepositionElementCount: function(e) {
		let margin = 6,
			hSpacing = 5;
		var vSpacing = 5;

		if(!this.Documents[e.view.document.URL]){
			console.error('SL+: Unable to find document info for %s in %o', e.view.document.URL, this.Documents);
			return;
		}

		let di = this.Documents[e.view.document.URL],
			tde = this.TopDocument.documentElement,
			elemRect = this.ElementCount.getBoundingClientRect(),
			offset = {
				x: di.offset.x,
				y: di.offset.y,
			};

		/* Find proper top document x/y coordinates */
		if(e.view.document == this.TopDocument){
			offset.x += e.pageX;
			offset.y += e.pageY;
		} else {
			offset.x += e.clientX;
			offset.y += e.clientY;
		}

		/* Determine acceptable positions, prefers outside of this.SelectionRect then topLeft */
		if(offset.x <= this.SelectionRect.left || offset.y <= this.SelectionRect.top) {
			offset.y - tde.scrollTop - elemRect.height - margin - vSpacing > 0
				? offset.y -= elemRect.height + vSpacing 	/* Top side is good and preferred, move above cursor */
				: offset.y += vSpacing;						/* Top side is no good, move below cursor */
		} else {
			offset.y + elemRect.height + margin - tde.scrollTop < tde.clientHeight
				? offset.y += vSpacing						/* Bottom side is good, move below cursor */
				: offset.y -= elemRect.height + vSpacing;	/* Bottom side is no good, move above cursor */
		}

		offset.x - tde.scrollLeft - elemRect.width - margin - hSpacing > 0
			? offset.x -= elemRect.width + hSpacing		/* Left side is good and preferred, move to left of cursor */
			: offset.x += hSpacing;						/* Left side is no good, move to right of cursor */

		/* Ensure that ElementCount will not extend document */
		offset.x = Math.min(offset.x, tde.clientWidth - elemRect.width - margin + tde.scrollLeft);	/* No farther right than viewport allows */
		offset.y = Math.min(offset.y, tde.clientHeight - elemRect.height - margin + tde.scrollTop);	/* No farther down than viewport allows */
		offset.x = Math.max(offset.x, margin);	/* No less than margin */
		offset.y = Math.max(offset.y, margin);	/* No less than margin */

		ApplyStyle(this.ElementCount, {
			top: offset.y + 'px',
			left: offset.x + 'px'
		});
	},

	/* Calculates which elements intersect with the selection */
	CalcSelectedElements: function() {
		this.ClearSelectedElements();
		if(this.Element.style.display != 'none') {
			var HighLinkFontSize = 0;
			var HighJsLinkFontSize = 0;

			var TypesInPriorityOrder = new Array('Links', 'JsLinks', 'Checkboxes', 'Buttons', 'RadioButtons', 'Clickable');
			var TypeCounts = {'Links': 0, 'JsLinks': 0, 'Checkboxes': 0, 'Buttons': 0, 'RadioButtons': 0, Clickable: 0};

			for(var URL in this.Documents) {
				//noinspection JSUnfilteredForInLoop
				var ti = this.Documents[URL];
				var DocRect = new Rect(0, 0, ti.height, ti.width)
					.Offset(ti.offset.x, ti.offset.y);
				var IntersectRect = this.SelectionRect.GetIntersectRect(DocRect);

				/* If we have no SelectRect then there is no intersection with ti.Document's coordinates */
				if(IntersectRect !== false) {
					/* If we're not in the top document, translate SelectRect to document coordinates */
					if(ti.Document != this.TopDocument) {
						IntersectRect.Offset(-ti.offset.x, -ti.offset.y);
						IntersectRect.Offset(ti.Document.body.scrollLeft, ti.Document.body.scrollTop);
					}

					dc('calc-elements', '%o.SelectableElements = %o', ti, ti.SelectableElements);
					/* Find Links Which Intersect With SelectRect */
					$A(ti.SelectableElements).forEach(function(elem) {
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

								this.IntersectedElements.push(elem);
							}
						}
					}, this);
				}
			}
			dc('calc-elements', 'IntersectedElements = %o, TypeCounts = %o', this.IntersectedElements, TypeCounts);

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
			this.SelectedElements = this.IntersectedElements.filter(filterFunction, this);

			dc('calc-elements', 'AfterFilter: Greatest=%s, SelectedElements = %o', Greatest, this.SelectedElements);

//			if(Greatest == 'Links' && this.SnapLinksPlus.Prefs.RemoveDuplicateUrls) {
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

			// Apply the style on the selected elements.
			var OutlineStyle = this.SnapLinksPlus.Prefs.SelectedElementsBorderWidth + 'px solid ' + this.SnapLinksPlus.Prefs.SelectedElementsBorderColor;
			this.SelectedElements.forEach( function(elem) {
				(elem.SnapOutlines || [ elem ]).forEach( function(elem) {
					elem.style.MozOutline = OutlineStyle;	/* Pre FF13 */
					elem.style.outline = OutlineStyle;
				} );
			}, this );
			this.SelectedElementsType = Greatest;

			var linksText = this.SnapLinksPlus.LocaleBundle.formatStringFromName("snaplinks.status.links", [this.SelectedElements.length], 1);

			this.SnapLinksPlus.SnapLinksStatus = linksText;

			if (this.ElementCount) {
				// Remove the existing child elements.
				while (this.ElementCount.firstChild) {
					this.ElementCount.removeChild(this.ElementCount.firstChild);
				}

				// Add the links count.
				var linksElem = this.Window.document.createTextNode(linksText);
				this.ElementCount.appendChild(linksElem);
			}
		}
		dc('calc-elements', 'Final: SelectedElements = %o', this.SelectedElements);
	},

	/** Scroll on viewport edge. */
	scrollOnViewEdge: function (e) {
		var offsetX = 0;
		if (e.clientX < 0) {
			offsetX = e.clientX;

			if (offsetX > this.Window.scrollX) {
				offsetX = this.Window.scrollX;
			}
		} else if (e.clientX > this.TopDocument.defaultView.innerWidth) {
			offsetX = e.clientX - this.TopDocument.defaultView.innerWidth;
			var offsetMaxX = this.Window.scrollMaxX - this.Window.scrollX; 

			if (offsetX > offsetMaxX) {
				offsetX = offsetMaxX;
			}
		}

		var offsetY = 0;
		if (e.clientY < 0) {
			offsetY = e.clientY; 

			if (offsetY > this.Window.scrollY) {
				offsetY = this.Window.scrollY;
			}
		} else if (e.clientY > this.TopDocument.defaultView.innerHeight) {
			offsetY = e.clientY - this.TopDocument.defaultView.innerHeight;
			var offsetMaxY = this.Window.scrollMaxY - this.Window.scrollY;

			if (offsetY > offsetMaxY) {
				offsetY = offsetMaxY;
			}
		}

		// Scroll.
		if (offsetX != 0 || offsetY != 0) this.Window.scrollBy(offsetX, offsetY);
	}
} );
