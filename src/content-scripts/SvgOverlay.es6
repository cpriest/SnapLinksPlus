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
 * This class is intended to manage a transparent element sized to overlay the entire document and
 *    used to highlight elements in various ways.
 *
 *    To start with, it will just be to replace the elem.style.outline that's presently used and doesn't
 *    work correctly with elements which are clipped.
 */
class SvgOverlay {
	/**
	 * Creates the initial SVGSVGElement and adds it to the document
	 * @param style        string        The style to be applied to the SVGRect elements
	 */
	constructor(style) {
		this.style = style;
		this.Overlay = CreateElement(`
			<svg xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0px; left: 0px; z-index: 999999; width: ${docElem.scrollWidth}px; height: ${docElem.scrollHeight}px; ">
				<rect/> <!-- Used for easily cloning the properly namespaced rect -->
			</svg>
		`);
		document.body.insertBefore(this.Overlay, document.body.firstElementChild);

		this.HighlightElemMap    = new WeakMap();
		this.HighlightedElements = [];
		this.AvailableRects = [];
	}

	/**
	 * Gets or Creates an SVGRect element and returns it
	 * @returns SVGRect|Node
	 */
	GetRect() {
		if(this.AvailableRects.length)
			return this.AvailableRects.pop();

		let elem = this.Overlay.firstElementChild.cloneNode(false);
		this.Overlay.appendChild(elem);
		return elem;
	}

	/**
	 *
	 * @param tSvgElems SVGRect[]    An array of SVGRects that are no longer needed, they are hidden and added to available rects
	 */
	ReleaseRects(tSvgElems) {
		for(let elem of tSvgElems) {
			elem.style.display = 'none';
			this.AvailableRects.push(elem);
		}
	}

	/**
	 * Called to highlight document elements using the SvgOverlay layer
	 * @param tElems Element[]    An array of elements which represent the current set of elements to be highlighted
	 */
	Highlight(tElems) {
		let tPrevElems   = this.HighlightedElements,
			tUnhighlight = tPrevElems.filter(
				(elem) => { return !tElems.includes(elem); }
			),
			tHighlight   = tElems.filter(
				(elem) => { return !tPrevElems.includes(elem); }
			),
			offset       = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };

		/* Remove highlighting of elements no longer in tElems */
		for(let elem of tUnhighlight)
			this.ReleaseRects(this.HighlightElemMap.get(elem));

		/* Add highlights for elements new to tElems */
		for(let elem of tHighlight) {

			let tSvgRects = [];
			for(let r of ElemDocRects.get(elem)) {
				let svgRect = this.GetRect(),
					attr    = {
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
	 * Called manually to clean up when this object is no longer needed
	 */
	destructor() {
		/** @note: unsure of "best way" of memory management - let GC just handle it, or manually release
		 * 		The below code was original in place to properly release all references, but is it necessary?
		 *
		 *	for(let elem of this.HighlightedElements)
		 *		this.ReleaseRects(this.HighlightElemMap.get(elem));
		 *	this.HighlightElemMap    = new WeakMap();
		 *	this.HighlightedElements = [];
		 */
		this.Overlay.remove();
	}
}
