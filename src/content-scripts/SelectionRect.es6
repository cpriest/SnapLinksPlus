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
 * @property {int} top        The normalized top coordinate of the Rect
 * @property {int} left        The normalized left coordinate of the Rect
 * @property {int} bottom    The normalized bottom coordinate of the Rect
 * @property {int} right    The normalized right coordinate of the Rect
 * @property {int} width    The width of the Rect
 * @property {int} height    The height of the Rect
 */
class Rect {
	/**
	 * Constructs the {Rect} object
	 *
	 * @param {int} top     The top coordinate
	 * @param {int} left    The left coordinate
	 * @param {int} bottom  The bottom coordinate
	 * @param {int} right   The right coordinate
	 */
	constructor(top=0, left=0, bottom=0, right=0) {
		[this.originTop, this.originLeft]              = [top, left];
		[this.top, this.left, this.bottom, this.right] = [top, left, bottom, right];
		this.CalculateProperties();
	}

	/**
	 * @param {int} top     The initial top coordinate (typically of the mousedown event)
	 * @param {int} left    The initial left coordinate (typically of the mousedown event)
	 */
	SetOrigin(top, left) {
		this.originTop = top;
		this.originLeft = left;

		return this.CalculateProperties();
	}

	/**
	 * Sets the bottom/right coordinate and ensures top/left are lowest numbers in case of inversion
	 *
	 * @param {int} bottom    The bottom coordinate
	 * @param {int} right    The right coordinate
	 *
	 * @returns {Rect}
	 */
	SetBottomRight(bottom, right) {
		[this.top, this.left]     = [Math.min(this.originTop, bottom), Math.min(this.originLeft, right)];
		[this.bottom, this.right] = [Math.max(this.originTop, bottom), Math.max(this.originLeft, right)];
		return this.CalculateProperties();
	}

	/**
	 * Calculates additional properties after top/left/bottom/right changes
	 *
	 * @returns {Rect}
	 */
	CalculateProperties() {
		this.width  = this.right - this.left;
		this.height = this.bottom - this.top;
		return this;
	}

	/**
	 * Expands the rect by x, y.  eg: .Expand(1, 0) -> left--; right++;
	 *    Negative values are permitted to
	 *
	 * @param {int} x    The amount by which to expand the {Rect}
	 * @param {int} y    The amount by which to expand the {Rect}
	 *
	 * @returns {Rect}
	 */
	Expand(x, y) {
		[this.top, this.bottom] = [this.top - y, this.bottom + y];
		[this.left, this.right] = [this.left - x, this.right + x];
		return this.CalculateProperties();
	}

	/**
	 * Checks for intersection with another {Rect}
	 *
	 * @param {Rect} r    The {Rect} to check for intersection
	 *
	 * @returns {boolean}
	 */
	Intersects(r) {
		/* Some/most of this code is duplicated from other parts of this class for performance reasons */

		// If the greatest top is higher than the lowest bottom, they don't intersect
		let GreatestTop  = Math.max(this.top, r.top),
			LowestBottom = Math.min(this.bottom, r.bottom);
		if(GreatestTop > LowestBottom)
			return false;

		// If the greatest left is higher than the lowest right, they don't intersect
		let GreatestLeft = Math.max(this.left, r.left),
			LowestRight  = Math.min(this.right, r.right);
		return GreatestLeft <= LowestRight;
	}

	/**
	 * Clips the rect on each side to the tighter of the two {Rects} (this vs r)
	 *
	 * @param {Rect} r
	 *
	 * @returns {Rect}
	 */
	ClipTo(r) {
		[this.top, this.left]     = [Math.max(this.top, r.top), Math.max(this.left, r.left)];
		[this.bottom, this.right] = [Math.min(this.bottom, r.bottom), Math.min(this.right, r.right)];
		return this.CalculateProperties();
	}

	/**
	 * Returns a textual representation of the object for easy of debugging
	 *
	 * @returns {string}
	 */
	toString() { return `{ top: ${this.top}, left: ${this.left}, bottom: ${this.bottom}, right: ${this.right}, width: ${this.width}, height: ${this.height} }`; }
}

/**
 * DocRect extends Rect to easily create a rect the size of the document
 */
class DocRect extends Rect {
	constructor(doc) {
		let docElem = document.documentElement;
		super(0, 0, docElem.scrollHeight, docElem.scrollWidth);
	}
}

/**
 * Wrapper for the selection rectangle element
 */
class SelectionRect {
	/**
	 * @constructor
	 */
	constructor() {
		this.dims = new Rect();
		
		var bodyStyle = document.body.currentStyle || window.getComputedStyle(document.body);
		
		this.elContainer = CreateElement(
			'<div class="SL_Container" style="display: none;">' +
			'	<div style="outline: 2px dashed rgba(0,255,0,1); position: absolute; margin-left:-' + bodyStyle.marginLeft + '; z-index: 9999999; overflow: visible;" class="SL_SelRect">' +
			'	<div style="position: absolute; background: #FFFFD9; border: 1px solid black; border-radius: 2px; padding: 2px; font: normal 12px Verdana; white-space: nowrap;"></div>' +
			'	</div>' +
			'</div>'
		);
		this.elRect = this.elContainer.firstElementChild;

		document.body.insertBefore(this.elContainer, document.body.firstElementChild);
	}

	/**
	 * @param {int} top     The initial top coordinate (typically of the mousedown event)
	 * @param {int} left    The initial left coordinate (typically of the mousedown event)
	 *
	 * @returns {SelectionRect}
	 */
	SetOrigin(top, left) {
		this.dims.SetOrigin(top, left);
		this.elContainer.style.display = '';

		return this;
	}

	/**
	 * Set the bottom right of the rect, really the current mouse coordinates
	 *
	 * @param {int} bottom        The bottom coordinate of the rect to set
	 * @param {int} right        The right coordinate of the rect to set
	 *
	 * @returns {SelectionRect}
	 */
	SetBottomRight(bottom, right) {
		let dr = (new DocRect(document))
			.Expand(-2, -2);
		/* Based on current fixed style */
		this.dims
			.SetBottomRight(bottom, right)
			.ClipTo(dr);

		[this.elRect.style.top, this.elRect.style.left]     = [this.dims.top + 'px', this.dims.left + 'px'];
		[this.elRect.style.height, this.elRect.style.width] = [this.dims.height + 'px', this.dims.width + 'px'];

		this.elRect.style.display = this.IsLargeEnoughToActivate()
			? ''
			: 'none';

		return this;
	}

	/**
	 * Sets the label for the rect to {count} Links
	 * @param {int} count    The count of the links to set the label to
	 *
	 * @returns {SelectionRect}
	 */
	SetCounter(count) {
		this.elRect.firstElementChild.innerHTML = `${count} Links`;
		return this;
	}

	/**
	 * Re-aligns the label depending on the rect parameters
	 *
	 * @param {boolean}    toRight        The right coordinate that the rect was set to
	 * @param {boolean}    toBottom        The bottom coordinate that the rect was set to
	 *
	 * @returns {SelectionRect}
	 */
	AlignCounter(toRight, toBottom) {
		let style = this.elRect.firstElementChild.style;

		[style.right, style.left] =
			toRight
				? [0, '']
				: ['', 0];
		[style.bottom, style.top] =
			toBottom
				? [0, '']
				: ['', 0];

		// move slightly to the right for not to be blocked by mouse pointer
		if(toRight == false && toBottom == false) {
			style.left = '16px';
		}
		return this;
	}

	/**
	 * Returns true if the rect is large enough to activate snap links
	 *
	 * @returns {boolean}
	 */
	IsLargeEnoughToActivate() {
		return this.dims.width > data.selection.activate.minX || this.dims.height > data.selection.activate.minY;
	}

	/**
	 * Called to indicate it's consumer is no longer using it, SetOrigin() will show the container again
	 *
	 * @returns {SelectionRect}
	 */
	Hide() {
		this.dims                      = new Rect();
		this.elContainer.style.display = 'none';
		this.elRect.style.display      = 'none';

		return this;
	}
}
