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

const CTRL  = 1,
	  ALT   = 2,
	  SHIFT = 4;

//  (MouseEvent.buttons bitfield)
const LMB = 1,	// Left Mouse Button
	  RMB = 2,	// Right Mouse Button
	  MMB = 4;	// Middle Mouse Button


const data = {
	scrollRate: 8,
};

class Rect {
	constructor(top, left, bottom, right) {
		[ this.originTop, this.originLeft ]              = [ top, left ];
		[ this.top, this.left, this.bottom, this.right ] = [ top, left, bottom, right ];
		this.calculateProperties();
	}

	setBottomRight(bottom, right) {
		[ this.top, this.left ]     = [ Math.min(this.originTop, bottom), Math.min(this.originLeft, right) ];
		[ this.bottom, this.right ] = [ Math.max(this.originTop, bottom), Math.max(this.originLeft, right) ];
		return this.calculateProperties();
	}

	calculateProperties() {
		this.width  = this.right - this.left;
		this.height = this.bottom - this.top;
		return this;
	}

	expand(x, y) {
		[ this.top, this.bottom ] = [ this.top - x, this.bottom + x ];
		[ this.left, this.right ] = [ this.left - y, this.right + y ];
		return this.calculateProperties();
	}

	clipTo(r) {
		[ this.top, this.left ]     = [ Math.max(this.top, r.top), Math.max(this.left, r.left) ];
		[ this.bottom, this.right ] = [ Math.min(this.bottom, r.bottom), Math.min(this.right, r.right) ];
		return this.calculateProperties();
	}

	toString() { return `{ top: ${this.top}, left: ${this.left}, bottom: ${this.bottom}, right: ${this.right}, width: ${this.width}, height: ${this.height} }`; }
}

class DocRect extends Rect {
	constructor(doc) {
		let docElem = document.documentElement;
		super(0, 0, docElem.offsetHeight, docElem.offsetWidth);
	}
}

class SelectionRect {
	constructor(top, left) {
		this.uiElem = CreateElement('<div style="outline: 2px dashed rgba(0,255,0,1); position: absolute; z-index: 9999999;" class="SL_SelRect"></div>');
		this.dims   = new Rect(top, left, top, left);
		document.body.insertBefore(this.uiElem, document.body.firstElementChild);
	}

	setBottomRight(bottom, right) {
		let dr = (new DocRect(document))
			.expand(-2, -2);
		this.dims
			.setBottomRight(bottom, right)
			.clipTo(dr);

		[ this.uiElem.style.top, this.uiElem.style.left ]     = [ this.dims.top + 'px', this.dims.left + 'px' ];
		[ this.uiElem.style.height, this.uiElem.style.width ] = [ this.dims.height + 'px', this.dims.width + 'px' ];
	}

	remove() {
		this.uiElem.parentNode.removeChild(this.uiElem);
		delete this.uiElem;
	}
}

new (class EventHandler {
	constructor() {
		this.RegisterActivationEvents();
		this._onMouseUp   = this.onMouseUp.bind(this);
		this._onMouseMove = this.onMouseMove.bind(this);
	}

	RegisterActivationEvents() {
		window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
	}

	onMouseDown(e) {
		/* Static use of no-modifiers down and right mouse button down */
		e.mods = (e.ctrlKey) + (e.altKey << 1) + (e.shiftKey << 2);

		if(e.buttons == RMB) {
			this.CurrentSelection = new SelectionRect(e.pageY, e.pageX);
			window.addEventListener('mouseup', this._onMouseUp, true);
			window.addEventListener('mousemove', this._onMouseMove, true);
			this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
		}
	}

	onMouseMove(e) {
		this.LastMoveEvent = e;
	}

	onMouseMoveInterval() {
		let e       = this.LastMoveEvent,
			docElem = document.documentElement;

		if(!e)
			return;

		this.CurrentSelection.setBottomRight(e.pageY, e.pageX);

		if(e.clientX < 0)
			docElem.scrollLeft += docElem.clientWidth / data.scrollRate;
		else if(e.clientX > docElem.clientHeight)
			docElem.scrollLeft -= docElem.clientWidth / data.scrollRate;
		if(e.clientY < 0)
			docElem.scrollTop -= docElem.clientHeight / data.scrollRate;
		else if(e.clientY > docElem.clientHeight)
			docElem.scrollTop += docElem.clientHeight / data.scrollRate;

		delete this.LastMoveEvent;
	}

	onMouseUp(e) {
		window.removeEventListener('mouseup', this._onMouseUp, true);

		clearInterval(this.mmTimer);
		delete this.mmTimer;

		window.removeEventListener('mousemove', this._onMouseMove, true);
		this.CurrentSelection.remove();
		delete this.CurrentSelection;
	}
});
