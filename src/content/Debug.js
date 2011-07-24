/*
 *  Debug.js
 *
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
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
 
/* This class primarily was written to validate the selection rectangle and bounding rect element functionality
 *
 * It would seem this method of calculation should work wherever, but if there are problem pages this class can
 * be used to diagnose where there may be an issue with the algorithm.
 */
var SnapLinksDebug = new (Class.create({
	
	/* Flags to indicate what should be highlighted at load and on mouse over, as well as how to highlight them */
	Flags: {
		Links: {
			LinkStyle: 			{ border: '1px solid blue' },
			ClientRectStyle:	{ backgroundColor: 'black', opacity: .3 },
			
			OnLoad: {
				ApplyLinkStyle:			false,
				ShowClientRects:		false
			},
			OnMouseOver: {
				ApplyLinkStyle: 		false,
				ShowClientRects:		false
			}
		}
	},
	
	DebugLinksAtLoad: 		{ get: function() { return this.Flags.Links.OnLoad.ApplyLinkStyle || this.Flags.Links.OnLoad.ShowClientRects; }	},
	DebugLinksOnMouseOver: 	{ get: function() { return this.Flags.Links.OnMouseOver.ApplyLinkStyle || this.Flags.Links.OnMouseOver.ShowClientRects; }	},
	
	initialize: function() {
		if(this.DebugLinksAtLoad || this.DebugLinksOnMouseOver)
			gBrowser.addEventListener('load', this.OnDocumentLoaded.bind(this), true);
	},

	OnDocumentLoaded: function(e) {			
		this.Document = e.target;
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
		}, this );
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
				cursor		: 'pointer'
			}, this );
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
