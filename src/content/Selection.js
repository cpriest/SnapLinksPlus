/*
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
 */
  
/** Selection class handles the selection rectangle and accompanying visible element */
var Selection = Class.create({ 
	X1: 0, Y1: 0, X2: 0, Y2: 0,
	
	IntersectedElements: 	[ ],
	SelectedElements: 		[ ],
	
	/* Internal flag to control selecting all links or all links matching the greatest size */
	SelectLargestFontSizeIntersectionLinks:		true,
	
	/* Returns a rect whos X1,Y1 are the closest to zero of the four corners */
	NormalizedRect: {
		get: function() { 
			return {	X1: Math.min(this.X1,this.X2),	Y1: Math.min(this.Y1,this.Y2),
						X2: Math.max(this.X1,this.X2),	Y2: Math.max(this.Y1,this.Y2),	}
		},
	},
	
	/* Internal Flag indicating that a selection has been started */
	DragStarted: false,
	
	initialize: function(PanelContainer) {
		this.PanelContainer = PanelContainer;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), true);
		this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
		
		window.addEventListener('resize', this.OnWindowResize.bind(this), true);
		
		this._OnMouseMove 	= this.OnMouseMove.bind(this);
		this._OnKeyDown		= this.OnKeyDown.bind(this);
		this._OnKeyUp		= this.OnKeyUp.bind(this);
	},
	
	/* Element bounding rectangles are calculated at the start, if the window is resized during a drag, then we recalculate */
	OnWindowResize: function(e) {
		if(this.DragStarted == true)
			this.CalculateSnapRects();
	},
	
	/* Starting Hook for beginning a selection */
	OnMouseDown: function(e) {
		if(e.button != SnapLinks.Prefs.SelectionButton)
			return;

		this.Document = e.target.ownerDocument;
			
		/** Initializes the starting mouse position */
		this.X1 = Math.min(e.pageX,this.Document.documentElement.offsetWidth + this.Document.defaultView.pageXOffset);
		this.Y1 = e.pageY;

		this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
		this.PanelContainer.addEventListener('keydown', this._OnKeyDown, true);
		this.PanelContainer.addEventListener('keyup', this._OnKeyUp, true);
	},
	
	OnMouseMove: function(e) {
		if(this.Element) {
			if(e.clientX < 0 || e.clientY < 0 || e.clientX > this.PanelContainer.clientWidth || e.clientY > this.PanelContainer.clientHeight)
				this.Element.style.display = 'none';
			else
				this.Element.style.display = '';
		}

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
																													
	//		SnapLinks.Selection.X1 = Math.max(Math.min(Math.max(this.Document.width,minWidth),SnapLinks.Selection.X1),0);
	//		SnapLinks.Selection.Y1 = Math.max(Math.min(Math.max(this.Document.height,minHeight),SnapLinks.Selection.Y1),0);
		} else {
			this.ExpandSelectionTo(Math.min(e.pageX), e.pageY);
		}
	},
	
	OnMouseUp: function(e) {
		this.RemoveEventHooks();
	},

	OnKeyDown: function(e) {
		if(e.keyCode == KeyboardEvent.DOM_VK_SHIFT ) {
			this.SelectLargestFontSizeIntersectionLinks = false;
			this.UpdateElement();
		}
	},
	
	OnKeyUp: function(e) {
		if(e.keyCode == KeyboardEvent.DOM_VK_SHIFT ) {
			this.SelectLargestFontSizeIntersectionLinks = true;
			this.UpdateElement();
		}
	},
	
	/* Creates the selection rectangle element, returns true if element exists or was created successfully */
	Create: function() {
		if(this.DragStarted == true)
			return true;
			
		if(Math.abs(this.X1-this.X2) > 4 || Math.abs(this.Y1-this.Y2) > 4) {
			var InsertionNode = (this.Document.documentElement) ? this.Document.documentElement : this.Document;
			
			this.Element = this.Document.createElementNS('http://www.w3.org/1999/xhtml', 'snaplRect');
			if(InsertionNode && this.Element) {
				this.Element.style.color = SnapLinks.Prefs.SelectionBorderColor;
				this.Element.style.border = SnapLinks.Prefs.SelectionBorderWidth + 'px dotted';
				this.Element.style.position = 'absolute';
				this.Element.style.zIndex = '10000';
				this.Element.style.left = this.X1 + 'px'; 
				this.Element.style.top = this.Y1 + 'px';
				InsertionNode.appendChild(this.Element);

				this.DragStarted = this.Element.parentNode != undefined;

				if(this.DragStarted) {
					if(SnapLinks.Prefs.ShowSelectedCount)
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

//		var Start = (new Date()).getMilliseconds();
		$A(this.Document.links).forEach( function( link ) {
			link.SnapRects = GetElementRects(link, offset);
			delete link.SnapFontSize;
		});
//		var End = (new Date()).getMilliseconds();
//		Log("Time = %sms", Math.round(End - Start, 2));
	},

	/** Clears the selection by removing the element, also clears some other non-refactored but moved code */
	Clear: function() {
		if (this.Element)
			this.Element.parentNode.removeChild(this.Element);
		delete this.Element;
		
		this.ClearSelectedElements();
		
		this.X1=0; this.X2=0; this.Y1=0; this.Y2=0;
		this.DragStarted = false;
		this.SelectLargestFontSizeIntersectionLinks = true;
		this.RemoveEventHooks();
		
		delete this.CalculateWindowWidth;
	},
	/* Clears the selection style from the currently selected elements */
	ClearSelectedElements: function() {
		this.IntersectedElements = [ ];

		this.SelectedElements.forEach( function(elem) {
			elem.style.MozOutline = '';
		} );
		this.SelectedElements = [ ];
	},

	RemoveEventHooks: function() {
		this.PanelContainer.removeEventListener('keydown', this._OnKeyDown, true);
		this.PanelContainer.removeEventListener('keyup', this._OnKeyUp, true);
		this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
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
	
	/* Updates the visible position of the element */
	UpdateElement: function() {
		if(this.Create()) {
			ApplyStyle(this.Element, {
				width 	: Math.abs(this.X1-this.X2) - SnapLinks.Prefs.SelectionBorderWidth + 'px',
				height 	: Math.abs(this.Y1-this.Y2) - SnapLinks.Prefs.SelectionBorderWidth + 'px',
				top 	: Math.min(this.Y1,this.Y2) - SnapLinks.Prefs.SelectionBorderWidth + 'px',
				left 	: Math.min(this.X1,this.X2) - SnapLinks.Prefs.SelectionBorderWidth + 'px',
			} );
			
			this.CalcSelectedElements();
		}
	},
	
	/* Calculates which elements intersect with the selection */
	CalcSelectedElements: function() {
		this.ClearSelectedElements();
		if(this.Element.style.display != 'none') {
			var SelectRect = this.NormalizedRect;
			var HighFontSize = 0;
			
			/* Find Links Which Intersect With Selection Rectangle */
			$A(this.Document.links).forEach( function( link ) {
				var Intersects = link.SnapRects.some( function(Rect) {
					return !( SelectRect.X1 > Rect.right || SelectRect.X2 < Rect.left || SelectRect.Y1 > Rect.bottom || SelectRect.Y2 < Rect.top );
				});
				
				if(Intersects) {
					if(this.SelectLargestFontSizeIntersectionLinks) {
						var sz=content.document.defaultView.getComputedStyle(link, "font-size");
						if(sz.fontSize.indexOf("px")>=0)
							link.SnapFontSize=parseFloat(sz.fontSize);
						
						if(link.SnapFontSize > HighFontSize)
							HighFontSize = link.SnapFontSize;
					}
					
					this.IntersectedElements.push(link);
				}
			}, this );
			
			this.IntersectedElements.forEach( function(elem) {
				if(!this.SelectLargestFontSizeIntersectionLinks || elem.SnapFontSize == HighFontSize)
					this.SelectedElements.push(elem);
			}, this);
			
			this.SelectedElements.forEach( function(elem) {
				elem.style.MozOutline = SnapLinks.Prefs.SelectedElementsBorderWidth + 'px solid ' + SnapLinks.Prefs.SelectedElementsBorderColor;
			} );
		}
	},
} );