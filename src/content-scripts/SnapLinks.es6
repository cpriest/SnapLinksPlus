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

// Pub-Sub Events
const // DragStarted     = 'DragStarted',
	  DragRectChanged = 'DragRectChanged',
	  DragCompleted   = 'DragCompleted';

const DocSizeChanged  = 'DocSizeChanged';


/**
 * The main Event Handler for Snap Links, registers/un-registers event handlers as appropriate
 *
 * @refactor This class is probably doing too much
 */
class EventHandler {
	/**
	 * @constructor
	 */
	constructor() {
		this._onMouseUp     = this.onMouseUp.bind(this);
		this._onMouseMove   = this.onMouseMove.bind(this);
		this._onContextMenu = this.onContextMenu.bind(this);
		this._onKeyDown     = this.onKeyDown.bind(this);

		document.addEventListener('mousedown', this.onMouseDown.bind(this), true);
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseDown(e) {
		/* Static use of no-modifiers down and right mouse button down */
		e.mods = (e.ctrlKey) + (e.altKey << 1) + (e.shiftKey << 2);

		if(e.buttons == RMB) {
			switch(e.mods) {
				// @Development
				case CTRL + ALT:
					if(data.DevMode) {
						this.StopNextContextMenu();
						chrome.runtime.sendMessage({ Action: RELOAD_EXTENSION });
					}
					break;

				case NONE:
					this.BeginDrag(e);
					break;
			}
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseMove(e) { this.LastMouseEvent = e; }

	/**
	 * @param {MouseEvent} e
	 */
	onMouseUp(e) {
		if(this.CurrentSelection.IsLargeEnoughToActivate())
			this.StopNextContextMenu();

		this.EndDrag(e);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	onKeyDown(e) {
		switch(e.key) {
			case 'Escape':
				this.EndDrag(e);
				break;
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	onContextMenu(e) {
		window.removeEventListener('contextmenu', this._onContextMenu, true);
		e.preventDefault();
	}

	/**
	 * Initializes the start of the lasso rectangle drag
	 *
	 * @param {MouseEvent} e
	 */
	BeginDrag(e) {
		this.CurrentSelection =
			(this.CurrentSelection || new SelectionRect())
				.SetOrigin(e.pageY, e.pageX);

		this.LastMouseEvent = e;

		// Chrome doesn't support/need set/releaseCapture
		if(document.documentElement.setCapture)
			document.documentElement.setCapture(true);

		document.addEventListener('mouseup', this._onMouseUp, true);
		document.addEventListener('mousemove', this._onMouseMove, true);
		document.addEventListener('keydown', this._onKeyDown, true);

		sub(ElementsSelected, (topic, Elements) => {
			this.SelectedElements = Elements;
		});

		this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
	}

	/**
	 * Called regularly by an interval timer setup in BeginDrag()
	 */
	onMouseMoveInterval() {
		let e       = this.LastMouseEvent;

		if(!this.docSize || this.docSize.x != docElem.scrollWidth || this.docSize.y != docElem.scrollHeight) {
			this.docSize = { x: docElem.scrollWidth, y: docElem.scrollHeight };
			pub(DocSizeChanged, this.docSize );
		}

		if(e) {
			this.IntervalScrollOffset = {
				x: e.clientX < 0
					? e.clientX
					: e.clientX > docElem.clientWidth
					   ? e.clientX - docElem.clientWidth
					   : 0,
				y: e.clientY < 0
					? e.clientY
					: e.clientY > docElem.clientHeight
					   ? e.clientY - docElem.clientHeight
					   : 0,
			};

			this.MousePos = { clientX: e.clientX, clientY: e.clientY };
			delete this.LastMouseEvent;
		}

		docElem.scrollLeft += this.IntervalScrollOffset.x;
		docElem.scrollTop += this.IntervalScrollOffset.y;

		/* Set our bottom right to scroll + max(clientX/Y, clientWidth/Height) */
		this.CurrentSelection.SetBottomRight(
			docElem.scrollTop + Math.min(this.MousePos.clientY, docElem.clientHeight),
			docElem.scrollLeft + Math.min(this.MousePos.clientX, docElem.clientWidth));
	}

	/**
	 * @param {MouseEvent|KeyboardEvent} e
	 */
	EndDrag(e) {
		document.removeEventListener('mouseup', this._onMouseUp, true);
		document.removeEventListener('mousemove', this._onMouseMove, true);
		document.removeEventListener('keydown', this._onKeyDown, true);

		this.mmTimer = clearInterval(this.mmTimer);

		if(e.type != "mouseup" || !this.CurrentSelection.IsLargeEnoughToActivate())
			delete this.SelectedElements;

		pub( DragCompleted, { SelectedElements: this.SelectedElements, e: e } );
		delete this.SelectedElements;
	}

	/**
	 * Stops the next context menu from showing, will de-register its-self upon one cycle
	 */
	StopNextContextMenu() {
		window.addEventListener('contextmenu', this._onContextMenu, true);
	}
}

let eh = new EventHandler();
