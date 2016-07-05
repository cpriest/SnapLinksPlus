/*
 * Copyright (c) 2016 Clint Priest
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

"use strict";

/**
 * This class is responsible for:
 *  - Identifying/Tracking which elements in the document are selectable
 *  - Quickly filtering selectable elements by a rect
 *
 *  @plan
 *    Current plan for 'quickly' filtering selectable elements is to index by element.getClientBoundingRect().top divided into N buckets
 */
class ElementHighlighter {
	/**
	 * Initializes the ElementHighlighter
	 *
	 * @param Overlay	SvgOverlay	The overlay element to use
	 * @param style		string		The style to be applied to the SVGRect elements
	 */
	constructor(Overlay, style) {
		this.Overlay = Overlay;
		this.style = style;

		this.HighlightElemMap = new WeakMap();
		this.HighlightedElements = [];
	}

	/**
	 * Called to highlight document elements using the SvgOverlay layer
	 * @param tElems Element[]	An array of elements which represent the current set of elements to be highlighted
	 */
	Highlight(tElems) {
		let tPrevElems  = this.HighlightedElements,
			tUnhighlight = tPrevElems.filter(
				(elem) => { return !tElems.includes(elem); }
			),
			tHighlight   = tElems.filter(
				(elem) => { return !tPrevElems.includes(elem); }
			),
			offset = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };

		/* Remove highlighting of elements no longer in tElems */
		for(let elem of tUnhighlight)
			this.Overlay.ReleaseRects(this.HighlightElemMap.get(elem));

		/* Add highlights for elements new to tElems */
		for(let elem of tHighlight) {

			let tSvgRects = [ ];
			for(let r of ElemDocRects.get(elem)) {
				let svgRect = this.Overlay.GetRect(),
					attr = {
						x     : r.left,
						y     : r.top,
						width : r.width,
						height: r.height,
						style : this.style,
					};

				for(let name in attr)
					svgRect.setAttribute(name, attr[name]);

				tSvgRects.push(svgRect);
			}
			this.HighlightElemMap.set(elem, tSvgRects);
		}
		this.HighlightedElements = tElems;
	}

	/**
	 * Remove all highlights from the overlay and clear our internals
	 */
	Unhighlight() {
		for(let elem of this.HighlightedElements)
			this.Overlay.ReleaseRects(this.HighlightElemMap.get(elem));
		this.HighlightElemMap = new WeakMap();
		this.HighlightedElements = [];
	}

	/**
	 * Called manually when this object is destroyed to clean up
	 */
	destruct() {
		this.Unhighlight();
		delete this.HighlightElemMap;
	}
}

