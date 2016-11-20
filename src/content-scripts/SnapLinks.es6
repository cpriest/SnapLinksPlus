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

let LastModifierKeys;

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
		this._onKeyUp       = this.onKeyUp.bind(this);

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
				case CTRL + ALT:												// #DevCode
					this.StopNextContextMenu();									// #DevCode
					chrome.runtime.sendMessage({ Action: RELOAD_EXTENSION });	// #DevCode
					e.preventDefault(); 										// #DevCode
					e.stopPropagation();										// #DevCode
					break;														// #DevCode

				case NONE:
					this.BeginDrag(e);
					break;
			}
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseMove(e) {
		this.LastMouseEvent = AddModsToEvent(e);
		LastModifierKeys = e.mods;
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseUp(e) {
		this.EndDrag(e);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	onKeyDown(e) {
		e = AddModsToEvent(e);
		switch(e.key) {
			case 'Escape':
				this.EndDrag(e);
				e.stop();
				return;
		}
		if(this.CurrentSelection.IsLargeEnoughToActivate())
			e.stop();
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	onKeyUp(e) {
		e = AddModsToEvent(e);

		if(this.CurrentSelection.IsLargeEnoughToActivate())
			e.stop();
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
		document.addEventListener('keyup', this._onKeyUp, true);

		sub(ElementsSelected, (topic, Elements) => {
			this.SelectedElements = Elements;
		});

		this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
	}

	/**
	 * Called regularly by an interval timer setup in BeginDrag()
	 */
	onMouseMoveInterval() {
		let e = this.LastMouseEvent;

		if(!this.docSize || this.docSize.x != docElem.scrollWidth || this.docSize.y != docElem.scrollHeight) {
			this.docSize = { x: docElem.scrollWidth, y: docElem.scrollHeight };
			pub(DocSizeChanged, this.docSize);
		}

		let [ clientWidth, clientHeight ] = GetClientDims();

		if(e) {
			this.IntervalScrollOffset = {
				x: e.clientX < 0
					? e.clientX
					: e.clientX > clientWidth
					   ? e.clientX - clientWidth
					   : 0,
				y: e.clientY < 0
					? e.clientY
					: e.clientY > clientHeight
					   ? e.clientY - clientHeight
					   : 0,
			};

			this.MousePos = { clientX: e.clientX, clientY: e.clientY };
			delete this.LastMouseEvent;
		}

		window.scrollBy(this.IntervalScrollOffset.x, this.IntervalScrollOffset.y);

		/* Set our bottom right to scroll + max(clientX/Y, clientWidth/Height) */
		this.CurrentSelection.SetBottomRight(
			window.scrollY + Math.min(this.MousePos.clientY, clientHeight),
			window.scrollX + Math.min(this.MousePos.clientX, clientWidth)
		);
	}

	/**
	 * @param {MouseEvent|KeyboardEvent} e
	 */
	EndDrag(e) {
		this.mmTimer = clearInterval(this.mmTimer);

		switch(e.type) {
			case 'mouseup':
				if(this.CurrentSelection.IsLargeEnoughToActivate()) {
					this.StopNextContextMenu();
					pub(DragCompleted, { SelectedElements: this.SelectedElements, e: e });

					/**
					 * Unfortunately ActionMgr has to be called directly within the event hook chain,
					 * using pub/sub results in actions being considered "outside of short running user-generated event handlers
					 * @note Perhaps a synchronous channel may work, something to try in the future
					 **/
					if(this.SelectedElements)
						ActionHandler.ActUpon(this.SelectedElements, e);
				}
				break;
			case 'keydown':
				this.StopNextContextMenu();
				if(!(e.mods & SHIFT && e.key == 'Escape'))
					pub(DragCompleted, { SelectedElements: [], e: e });
				break;
		}

		delete this.SelectedElements;

		document.removeEventListener('mouseup', this._onMouseUp, true);
		document.removeEventListener('mousemove', this._onMouseMove, true);
		document.removeEventListener('keydown', this._onKeyDown, true);

		if(document.releaseCapture)
			document.releaseCapture();
	}

	/**
	 * Stops the next context menu from showing, will de-register its-self upon one cycle
	 */
	StopNextContextMenu() {
		window.addEventListener('contextmenu', this._onContextMenu, true);
	}
}

let eh = new EventHandler();
