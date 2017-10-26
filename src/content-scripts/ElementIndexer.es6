/*
 * Copyright (c) 2017 Clint Priest
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

let ElemDocRects = new (
	/**
	 * This class provides for a cached WeakMap of {Element} to
	 */
	class RectMapper {
		/** Creates a new RectMapper */
		constructor() {
			sub(DocSizeChanged, (topic, data, Subscription) => {
				this.clear();
			});

			this.clear();
		}

		/**
		 * Gets the elements bounding rect(s) in document coordinates
		 *
		 * @param elem    HtmlElement    The element being requested
		 * @param offset  object        The {x,y} offset the document is currently scrolled to (passed for performance reasons)
		 *
		 * @returns {Rect[]}
		 */
		get(elem, offset) {
			let Rects = this.ElemRects.get(elem);
			if(Rects)
				return Rects;

			Rects = this.GetElementRects(elem, offset);
			this.ElemRects.set(elem, Rects);
			return Rects;
		}

		/**
		 * Gets the elements bounding rect in document coordinates (largest rect containing all element rects)
		 *
		 * @param elem    HtmlElement    The element being requested
		 * @param offset  object        The {x,y} offset the document is currently scrolled to (passed for performance reasons)
		 *
		 * @returns {Rect}
		 */
		getBounding(elem, offset) {
			let Rects = this.get(elem, offset);
			if(Rects.length === 0)
				return new Rect();

			let br = Rects
				.reduce((dims, r) => {
					return {
						top:	Math.min(dims.top, r.top),
						left:	Math.min(dims.left, r.left),
						bottom: Math.max(dims.bottom, r.bottom),
						right:	Math.max(dims.right, r.right),
					};
				}, { top: Number.MAX_VALUE, left: Number.MAX_VALUE, bottom: 0, right: 0 });

			return new Rect(br.top, br.left, br.bottom, br.right);
		}

		/**
		 * Returns an array of { top, left, width, height } objects which combined make up the bounding rects of the given element,
		 *    this uses the built-in .getClientRects() and additionally compensates for 'block' elements which it would appear is not
		 *    handled appropriately for our needs by Mozilla or the standard
		 *
		 * @param {Element|HTMLInputElement}    elem        The element to get the client rects for
		 * @param {object}                        offset        An object with x, y parameters.  Used to offset the results of getClientRect() to make them documentRects.
		 *
		 * @return
		 **/
		GetElementRects(elem, offset) {
			offset = offset || { x: 0, y: 0 };

			let Rects = Array.from(elem.getClientRects());

			switch(elem.tagName) {
				case 'A':
					// If an anchor has no innerText except white-space and has an IMG child, just use the IMG
					if(elem.innerText.trim() == "" && elem.childElementCount == 1 && elem.firstElementChild.tagName == 'IMG') {
						Rects = Array.from(elem.firstElementChild.getClientRects());
					} else {
						// Otherwise, include all IMG elements within the <A>
						Array.from(elem.querySelectorAll('IMG'))
							.forEach(
								/** @param {Element} elem */
								(elem) =>
									Rects = Rects.concat(Array.from(elem.getClientRects()))
								);
					}
					break;
				case 'INPUT':
					if(['checkbox', 'radio'].indexOf(elem.type) !== -1) {
						if(elem.parentElement.tagName == 'LABEL')
							Rects = Rects.concat($A(elem.parentElement.getClientRects()));
						else if(elem.id) {
							for(let label of document.querySelectorAll('LABEL[for="' + elem.id + '"]'))
								Rects = Rects.concat($A(label.getClientRects()));
						}
					}
					break;
			}
			return Rects.map(function(rect) {
				return new Rect(rect.top + offset.y, rect.left + offset.x,
					rect.bottom + offset.y, rect.right + offset.x);
			});
		}

		/**
		 * Gets the computed font score for the given element, caching the results
		 *        Takes into account fontSize and bold
		 *
		 * @param {Element} elem    The element to retrieve the computed fontSize of
		 *
		 * @returns int
		 */
		GetFontScore(elem) {
			let CachedStyle = this.StyleCache.get(elem);

			if(!CachedStyle) {
				let ComputedStyle = window.getComputedStyle(elem);
				CachedStyle       = {
					fontSize  : ComputedStyle.fontSize,
					fontWeight: this.TranslateWeight(ComputedStyle.fontWeight),
				};
				CachedStyle.fontScore = (parseInt(CachedStyle.fontSize.replace(/\D+/g, '')) * 100) + (CachedStyle.fontWeight / 10);
				// console.log(elem.textContent, CachedStyle.fontSize, CachedStyle.fontWeight, CachedStyle.fontScore);								// #DevCode
				this.StyleCache.set(elem, CachedStyle);
			}
			return CachedStyle.fontScore;
		}

		/** Clears the cache of client rects */
		clear() {
			this.ElemRects  = new WeakMap();
			this.StyleCache = new WeakMap();
		}

		TranslateWeight(fontWeight) {
			let n;

			if(!isNaN(n = parseInt(fontWeight)))
				return n;
			if(fontWeight === 'bold')
				return 700;
			return 400;
		}
	}
)();

/**
 * This class is responsible for:
 *  - Identifying/Tracking which elements in the document are selectable
 *  - Quickly filtering selectable elements by a document coordinate rect
 */
let ElemIndex = new class ElementIndexer {
	/** Constructs a new ElementIndexer */
	constructor() {
		sub(DragRectChanged, (topic, data, Subscription) => {
			if(!this.Elements) {
				this.Elements = document.querySelectorAll(
					'A[href]:not([href=""]), ' +
					'INPUT[type="button"], ' +
					'INPUT[type="submit"], ' +
					'INPUT[type="reset"], ' +
					'INPUT[type="checkbox"], ' +
					'INPUT[type="radio"]'
				);

				this.UpdateIndex();
			}
			if(data.visible) {
				pub(ElementsSelected, this.Search(data.dims));
			}
		});

		sub(DragCompleted, () => {
			delete this.Elements;
		});
	}

	/**
	 * @private
	 * Updates the index of this.Elements separated into N buckets for quickly paring down the elements to be checked for intersection of the selection rectangle
	 */
	UpdateIndex() {
		let docHeight = docElem.scrollHeight,
			Buckets   = data.IndexBuckets,
			offset 	  = { x: window.scrollX, y: window.scrollY };

		this.ElemChecks = new Map();

		this.BoundaryIndex = [];
		for(let j = 0; j < Buckets; j++)
			this.BoundaryIndex[j] = new Set();

//		console.log('Buckets: %d, scrollY: %d, docHeight: %d', Buckets, scrollY, docHeight);			// #DevCode
//		console.log(this.BoundaryIndex);																// #DevCode

		let rr;
		if(data.Debug.Measure.IndexingSpeed)
			rr = new RateReporter('Calculated ${Count} Elements in ${Elapsed} (${PerSecond})');

		for(let elem of this.Elements) {

			// 5x Faster but less accurate in some cases
//			let br = elem.getBoundingClientRect();

			// 5x Slower but perfectly accurate
			let	br = ElemDocRects.getBounding(elem, offset);

			let topIdx = Math.floor(br.top * Buckets / docHeight),
				botIdx = Math.floor(br.bottom * Buckets / docHeight);

			if(!this.BoundaryIndex[topIdx] || !this.BoundaryIndex[botIdx]) {
				// Elements top or bottom is out of bounds, skip it
				if(data.Debug.Log.OutOfBoundElements)
					console.log('oob: %o, br.t: %d, br.b: %d, scrollY: %d, docHeight: %d', elem, br.top, br.bottom, scrollY, docHeight, topIdx, botIdx);
				continue;
			}

			this.BoundaryIndex[topIdx].add(elem);
			if(topIdx != botIdx)
				this.BoundaryIndex[botIdx].add(elem);
		}
		if(rr)
			rr.report(this.Elements.length);
	}

	/**
	 * Returns true if the element is visible
	 *
	 * @param {Element} elem
	 *
	 * @returns {boolean}
	 */
	IsVisible(elem) {
		let style = window.getComputedStyle(elem);

		// noinspection EqualityComparisonWithCoercionJS, JSValidateTypes
		return style.width == 0 &&
			   style.height == 0 &&
			   style.opacity == 0 &&
			   style.display != 'none' &&
			   style.visibility !== 'hidden';
	}

	/**
	 * Search the index for all elements that intersect with the selection rect
	 *
	 * @param {Rect} sel    The rect in document coordinates to search
	 */
	Search(sel) {
		let rr;
		if(data.Debug.Measure.SearchSpeed)
			rr = new RateReporter('Found ${Count} Elements in ${Elapsed} (${PerSecond})');

		let docHeight   = document.documentElement.scrollHeight,
			Buckets     = data.IndexBuckets,
			FirstBucket = Math.floor(sel.top * Buckets / docHeight),
			LastBucket  = Math.floor(sel.bottom * Buckets / docHeight),
			offset      = { x: window.scrollX, y: window.scrollY },
			Matches     = new Set();

		let [ clientWidth, clientHeight ] = GetClientDims();
		let elContainer = document.querySelector('DIV.SnapLinksContainer');

		// We move our container down the zIndex for document.elementFromPoint purposes, seems to have little impact on performance
		elContainer.style.zIndex = '-999999';

		for(let j = FirstBucket; j <= LastBucket; j++) {
			for(let elem of this.BoundaryIndex[j]) {
				if(Matches.has(elem))
					continue;

				let elemNotes = this.ElemChecks.get(elem) || { };

				// If the element is obscured, remove it and move on (could be in multiple buckets)
				if(true === elemNotes.Obscured) {
					this.BoundaryIndex[j].delete(elem);
					continue;
				}

				for(let r of ElemDocRects.get(elem, offset)) {
					if(!sel.Intersects(r))
						continue;

//					if(this.IsVisible(elem) === false)		// This is really slow!  The below section handles most
//						break;								// of this much faster as well as other situations

					// Check to see if the point in the middle of the rect is the element or a descendent, if not then
					// it is obscured.  This takes care of display: none, visibility: hidden & width/height of 0, does
					// not account for opacity: 0 though.
					if(undefined === elemNotes.Obscured) {
						let left = r.left + (r.width / 2) - offset.x,
							top  = r.top + (r.height / 2) - offset.y;

						if (left > 0 && left < clientWidth && top > 0 && top < clientHeight) {
							let elPoint = document.elementFromPoint(left, top);

							if(elPoint != elem && !elem.contains(elPoint) && elPoint.tagName !== 'LABEL') {
								elemNotes.Obscured = true;
								this.BoundaryIndex[j].delete(elem);

								// let yy, zzz = Array.from(document.elementsFromPoint(left, top));		// #DevCode
								// console.log(elem, elPoint, [zzz], zzz.indexOf(elem));   				// #DevCode

								break;
							} else {
								elemNotes.Obscured = false;
							}
						}
					}

					Matches.add(elem);
					break;	// for(let r of Rects...
				}
				this.ElemChecks.set(elem, elemNotes);
			}
		}
		elContainer.style.zIndex = '';

		if(rr)
			rr.report(Matches.size);

		return new CategorizedCollection(Matches);
	}
};
