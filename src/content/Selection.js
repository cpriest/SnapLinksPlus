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

try {
	Components.utils.import("chrome://snaplinksplus/content/Utility.js");
}
catch(e) {
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

	/* Starting Hook for beginning a selection */
	OnMouseDown: function(e) {
		this.Window = e.view.top;
		if(!this.SnapLinksPlus.ShouldActivate(e))
			return;

		var Document = e.target.ownerDocument;
		this.TopDocument = e.target.ownerDocument.defaultView.top.document;

		/** Initializes the starting mouse position */
		this.SelectionRect = new Rect(e.pageY, Math.min(e.pageX, Document.documentElement.offsetWidth + Document.defaultView.pageXOffset));

		/** Store all documents and sub-documents as well as their offset positions relative to top document */
		this.Documents = { };
		$A(this.TopDocument.body.querySelectorAll('IFRAME')).forEach(function(elem) {
			var contentWindow = elem.contentWindow,
				offset = { x: 0, y: 0 };
			do {
				offset.x += elem.offsetLeft;
				offset.y += elem.offsetTop;
				elem = elem.offsetParent;
			} while(elem != null);
			this.Documents[contentWindow.location.href] = {
				Document: 	contentWindow.document,
				height:		Math.max(contentWindow.document.documentElement.scrollHeight, contentWindow.document.body.scrollHeight),
				width:		Math.max(contentWindow.document.documentElement.scrollWidth, contentWindow.document.body.scrollWidth),
				offset: 	offset
			};
		}, this);
		this.Documents[this.TopDocument.location.href] = {
			Document: 	this.TopDocument,
			height:		Math.max(this.TopDocument.documentElement.scrollHeight, this.TopDocument.body.scrollHeight),
			width:		Math.max(this.TopDocument.documentElement.scrollWidth, this.TopDocument.body.scrollWidth),
			offset: 	{x: 0, y: 0}
		};

		/* If we aren't starting in the top document, change rect coordinates to top document origin */
		if(Document != this.TopDocument) {
			this.SelectionRect.Offset(-Document.body.scrollLeft, -Document.body.scrollTop);
			this.SelectionRect.Offset(this.Documents[Document.location.href].offset.x, this.Documents[Document.location.href].offset.y);
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
			pageX += this.Documents[e.view.location.href].offset.x - e.target.ownerDocument.body.scrollLeft;
			pageY += this.Documents[e.view.location.href].offset.y - e.target.ownerDocument.body.scrollTop;
		}

		/* Disabled At The Moment */
		if(false && e.altKey && !this.SnapLinksPlus.Prefs.ActivateRequiresAlt) {
			this.OffsetSelection(pageX - this.SelectionRect.right, pageY - this.SelectionRect.bottom);
		} else {
			this.ExpandSelectionTo(pageX, pageY);
		}
		
		if (this.ElementCount) {
			this.UpdateElementCount(e);
		}
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
					if(this.SnapLinksPlus.Prefs.ShowSelectedCount)
					{
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
		if(!this.Documents[Document.location.href])
			this.Documents[Document.location.href] = { Document: Document };

		/* If the last calculation was done at the same innerWidth, skip calculation */
		if(this.CalculateWindowWidth == this.Window.innerWidth && this.Documents[Document.location.href].SelectableElements != undefined)
			return;

		this.CalculateWindowWidth = this.Window.innerWidth;

		var offset = { x: Document.defaultView.scrollX, y: Document.defaultView.scrollY };
		var SelectableElements = [ ];
		
		var Start = (new Date()).getMilliseconds();

		$A(Document.links).forEach( function( link ) {
			try {
				link.SnapIsJsLink = this.jsRegExp.test(link.href); // Is a JavaScript link?

				// Skip JavaScript links, if the option is disabled.
				if (link.SnapIsJsLink &&
						!this.SnapLinksPlus.Prefs.HighlightJsLinksForClicking) {
					return;
				}
			}
			catch (e) {
				Components.utils.reportError(e);
			}

			link.SnapRects = GetElementRects(link, offset);
			delete link.SnapFontSize;
			SelectableElements.push(link);
		}, this);

		var Links = (new Date()).getMilliseconds();

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

		var Inputs = (new Date()).getMilliseconds();

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
		}, this );

		/* Any IMG/SPAN/DIV with a .onclick or event listener */
		var Clickable = (new Date()).getMilliseconds();
//
//		$A(Document.body.querySelectorAll('IMG, SPAN, DIV')).forEach( function(elem) {
//			if(elem.SnapLinksClickable || elem.ownerDocument.defaultView.getComputedStyle(elem).cursor == 'pointer') {
//				elem.SnapLinksClickable = true;
//				elem.SnapRects = GetElementRects(elem, offset);
//				SelectableElements.push(elem);
//			}
//		}, this );

		this.Documents[Document.location.href].SelectableElements = SelectableElements;

		var End = (new Date()).getMilliseconds();
		dc('performance', "CalculateSnapRects() -> Links: %sms, Inputs: %sms, Labels: %sms, Clickable: %sms, Total: %sms",
			Math.round(Links - Start, 2), Math.round(Inputs - Links, 2), Math.round(Clickable - Inputs, 2), Math.round(End - Clickable, 2), Math.round(End - Start, 2));
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
		
		delete this.CalculateWindowWidth;
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
		this.SelectionRect.right = Math.max(0, Math.min(X, this.Documents[this.TopDocument.location.href].width));
		this.SelectionRect.bottom = Math.max(0, Math.min(Y, this.Documents[this.TopDocument.location.href].height));
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

	UpdateElementCount: function(e) {
		var margin = 6;
		var hSpacing = 3;
		var vSpacing = 3;
		
		var docRect = {
			width:this.TopDocument.documentElement.clientWidth,
			height:this.TopDocument.documentElement.clientHeight
		};
		var elemRect = this.ElementCount.getBoundingClientRect();

		var offsetX = 0;
		var offsetY = 0;
		
		if ((e.clientX + hSpacing) <= margin) {
			offsetX = this.Window.scrollX + margin;
		} else if ((e.clientX + hSpacing + elemRect.width) >= (docRect.width - margin)) {
			offsetX = this.Window.scrollX + docRect.width - (elemRect.width + margin);
		} else {
			offsetX = e.pageX + hSpacing;
		}
		
		if ((e.clientY - elemRect.height - vSpacing) <= margin) {
			offsetY = this.Window.scrollY + margin;
		} else if ((e.clientY - vSpacing) >= (docRect.height - margin)) {
			offsetY = this.Window.scrollY + docRect.height - (elemRect.height + margin);
		} else {
			offsetY = e.pageY - elemRect.height - vSpacing;
		}
		
		ApplyStyle(this.ElementCount, {
			top:  offsetY + 'px',
			left: offsetX + 'px'
		} );
	},

	/* Calculates which elements intersect with the selection */
	CalcSelectedElements: function() {
		this.ClearSelectedElements();
		if(this.Element.style.display != 'none') {
			var HighLinkFontSize = 0;
			var HighJsLinkFontSize = 0;
			
			var TypesInPriorityOrder = new Array('Links', 'JsLinks', 'Checkboxes', 'Buttons', 'RadioButtons', 'Clickable');
			var TypeCounts = {'Links': 0, 'JsLinks': 0, 'Checkboxes': 0, 'Buttons': 0, 'RadioButtons': 0, Clickable: 0};

			for(var href in this.Documents) {
				var ti = this.Documents[href];
				var DocRect = new Rect(0, 0, ti.height, ti.width)
					.Offset(ti.offset.x, ti.offset.y);
				var SelectRect = this.SelectionRect.GetIntersectRect(DocRect);

				/* If we have no SelectRect then there is no intersection with ti.Document's coordinates */
				if(SelectRect !== false) {
					/* If we're not in the top document, translate SelectRect to document coordinates */
					if(ti.Document != this.TopDocument) {
						SelectRect.Offset(-ti.offset.x, -ti.offset.y);
						SelectRect.Offset(ti.Document.body.scrollLeft, ti.Document.body.scrollTop);
					}

					/* Find Links Which Intersect With SelectRect */
					$A(ti.SelectableElements).forEach(function(elem) {
						var Intersects = elem.SnapRects.some( SelectRect.IntersectsWith.bind(SelectRect) );

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
					filterFunction = function(elem) { return elem.tagName == 'A' && !elem.SnapIsJsLink && (!this.SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == HighLinkFontSize); };
					break;
				case 'JsLinks':
					filterFunction = function(elem) { return elem.tagName == 'A' && elem.SnapIsJsLink && (!this.SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == HighJsLinkFontSize); };
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
