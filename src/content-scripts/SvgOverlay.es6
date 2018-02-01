/*
 * Copyright (c) 2016-2018 Clint Priest
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

'use strict';

/**
 * This class is intended to manage a transparent element sized to overlay the entire document and
 *    used to highlight elements in various ways.
 *
 *    To start with, it will just be to replace the elem.style.outline that's presently used and doesn't
 *    work correctly with elements which are clipped.
 */
let SvgOverlay = new class SvgOverlayMgr {
	/**
	 * Creates the SvgOverlay Manager
	 */
	constructor() {
		sub(ContainerElementCreated, (topic, Container, Subscription) => {
			this.Init(Container);

			Subscription.unsub();
		});

		sub(ElementsSelected, (topic, Elements, Subscription) => {
			this.Highlight(Elements);
		});

		sub(DragCompleted, (topic, data, Subscription) => {
			this.Hide();
		});

//		/**
//		 * Where I'm At
//		 * 		The DOCSIZECHANGE even is all good!  sweet.
//		 *
//		 * 		Next Up:
//		 * 			Get a go() function going that CSP's a check against document size changes
//		 */
//		let Subscription = sub(DOCSIZECHANGE, (topic, e, Subscription) => {
//			console.log(topic, e);
//		});
	}

	/**
	 * Initializes the SvgOverlay
	 *
	 * @param {HTMLElement} Container    The SnapLinks Container Element
	 */
	Init(Container) {
		this.style   = Prefs.HighlightStyles_ActOnElements;
		this.Overlay = CreateElement(`
			<svg class="SnapLinksHighlighter" xmlns="http://www.w3.org/2000/svg">
				<rect width="0" height="0"/> <!-- Used for easily cloning the properly namespaced rect -->
			</svg>
		`);
		Container.appendChild(this.Overlay);

		this.HighlightElemMap    = new WeakMap();
		this.HighlightedElements = [];
		this.AvailableRects      = [];

		sub(DocSizeChanged, (topic, data, Subscription) => {
			this.Reposition();
		});
	}

	/**
	 * @protected
	 * Gets or Creates an SVGRect element and returns it
	 *
	 * @returns {SVGRectElement|Node}
	 */
	_AddRect(attr) {
		let elem;
		if(!this.AvailableRects.length) {
			elem = this.Overlay.firstElementChild.cloneNode(false);
			this.Overlay.appendChild(elem);
		} else {
			elem = this.AvailableRects.pop();
		}

		for(let name of Object.keys(attr))
			elem.setAttribute(name, attr[name]);

		return elem;
	}

	/**
	 * @param {Node[]}    tSvgElems    An array of SVGRects that are no longer needed, they are hidden and added to available rects
	 *
	 * @returns {SvgOverlayMgr}
	 */
	ReleaseRects(tSvgElems) {
		for(let elem of tSvgElems) {
			elem.style.display = 'none';
			this.AvailableRects.push(elem);
		}

		return this;
	}

	/**
	 * Called to highlight document elements using the SvgOverlay layer
	 *
	 * @param {CategorizedCollection|Array} Elements    A collection of elements which represent the current set of elements to be highlighted
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Highlight(Elements) {
		let tElems       = Elements.All || [],
			tPrevElems   = this.HighlightedElements,
			tUnhighlight = tPrevElems.filter(
				(elem) => { return !tElems.includes(elem); },
			),
			tHighlight   = tElems.filter(
				(elem) => { return !tPrevElems.includes(elem); },
			),
			offset       = { x: window.scrollX, y: window.scrollY };

		/* Remove highlighting of elements no longer in tElems */
		for(let elem of tUnhighlight)
			this.ReleaseRects(this.HighlightElemMap.get(elem));

		/* Add highlights for elements new to tElems */
		for(let elem of tHighlight) {

			let tSvgRects = [];

			for(let r of ElemDocRects.get(elem, offset)) {
				tSvgRects.push(
					this._AddRect({
						x:      r.left,
						y:      r.top,
						width:  r.width,
						height: r.height,
						style:  this.style,
						class:  'ActOn',
					}),
				);
			}
			this.HighlightElemMap.set(elem, tSvgRects);
		}
		this.HighlightedElements = tElems;

		// this.Overlay.style.display =
		// 	this.HighlightedElements.length
		// 		? ''
		// 		: 'none';

		return this;
	}

	AddIndexBoundaryMark(y) {
		this._AddRect({
			x:      0,
			y:      y,
			width:  docElem.scrollWidth,
			height: 2,
			style:  Prefs.HighlightStyles_IndexBoundaryMarker,
			class:  'IndexBoundaryMarker',
		});
	}

	AddPoint(x, y, type, attr = {}) {
		this._AddRect(Object.assign({
			x:      x,
			y:      y,
			width:  1,
			height: 1,
			style:  Prefs[`HighlightStyles_${type}`],
			class:  type,
		}, attr));
	}

	AddRect(x, y, width, height, type, attr = {}) {
		this._AddRect(Object.assign({
			x:      x,
			y:      y,
			width:  width,
			height: height,
			style:  Prefs[`HighlightStyles_${type}`],
			class:  type,
		}, attr));
	}

	/**
	 * Called to reconstruct and reposition all element highlights (such as onresize)
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Reposition() {
		let tPrevElems = this.HighlightedElements;
		this.Highlight([]);
		return this.Highlight(tPrevElems);
	}

	/**
	 * Called manually to clean up when this object is no longer needed
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Hide() { return this.Highlight([]); }

	/**
	 * Releases the rects that match the given selector
	 * @param {string} selector    Any valid css selector
	 */
	Release(selector) {
		this.ReleaseRects(Array.from(this.Overlay.querySelectorAll(selector)));
		return this;
	}
};
