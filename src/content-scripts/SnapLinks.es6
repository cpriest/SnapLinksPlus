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
 * The main Event Handler for Snap Links, registers/un-registers event handlers as appropriate
 *
 * @refactor This class is probably doing too much
 */
new (class EventHandler {
	/**
	 * @constructor
	 */
	constructor() {
		this.RegisterActivationEvents();
		this._onMouseUp     = this.onMouseUp.bind(this);
		this._onMouseMove   = this.onMouseMove.bind(this);
		this._onContextMenu = this.onContextMenu.bind(this);
		this._onKeyDown     = this.onKeyDown.bind(this);
		window.addEventListener('resize', _.throttle(this.onThrottledResize.bind(this), 100), true);
	}

	/**
	 *    Registers document/window always active events
	 */
	RegisterActivationEvents() {
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
					this.StopNextContextMenu();
					chrome.runtime.sendMessage({ Action: RELOAD_EXTENSION });
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

		if(this.SelectedElements) {
			this.ActUpon(this.SelectedElements, e);
			delete this.SelectedElements;
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	onKeyDown(e) {
		switch(e.key) {
			case 'Escape':
				this.EndDrag(e);
				break;
		}
	}

	/**
	 * Throttled by lodash lib _throttle function
	 *
	 * @param {MouseEvent} e
	 */
	onThrottledResize(e) {
		ElemDocRects.clear();

		if(this.SvgOverlay)
			this.SvgOverlay.Reposition();
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
		this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
	}

	/**
	 * Called regularly by an interval timer setup in BeginDrag()
	 */
	onMouseMoveInterval() {
		let e       = this.LastMouseEvent,
			docElem = document.documentElement;

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
		let NewBottom = docElem.scrollTop + Math.min(this.MousePos.clientY, docElem.clientHeight);
		let NewRight  = docElem.scrollLeft + Math.min(this.MousePos.clientX, docElem.clientWidth);
		this.CurrentSelection.SetBottomRight(NewBottom, NewRight);

		if(this.ElementIndexer) {
			this.SvgOverlay.Highlight(
				this.SelectedElements = this.ElementIndexer.Search(this.CurrentSelection.dims)
			);

			this.CurrentSelection.SetCounter((new Set(this.SelectedElements.Links.map((elem) => elem.href))).size);
			this.CurrentSelection.AlignCounter(this.CurrentSelection.dims.left != NewRight, this.CurrentSelection.dims.top != NewBottom);
		} else if(this.CurrentSelection.IsLargeEnoughToActivate()) {
			this.SvgOverlay     = this.SvgOverlay || new SvgOverlay(data.HighlightStyles.ActOnElements);
			this.ElementIndexer = new ElementIndexer();
		}
	}

	/**
	 * @param {MouseEvent|KeyboardEvent} e
	 */
	EndDrag(e) {
		document.removeEventListener('mouseup', this._onMouseUp, true);
		document.removeEventListener('mousemove', this._onMouseMove, true);
		document.removeEventListener('keydown', this._onKeyDown, true);

		this.mmTimer = clearInterval(this.mmTimer);

		this.CurrentSelection.Hide();
		this.SvgOverlay.Hide();

		delete this.ElementIndexer;
	}

	/** Stops the next context menu from showing, will de-register its-self upon one cycle */
	StopNextContextMenu() {
		window.addEventListener('contextmenu', this._onContextMenu, true);
	}

	/**
	 * Copies the given text to the clipboard
	 *
	 * @param {string} text
	 */
	CopyToClipboard(text) {
		const input          = document.createElement('textarea');
		input.style.position = 'fixed';
		input.style.opacity  = 0;
		input.value          = text;
		document.body.appendChild(input);
		input.select();
		document.execCommand('Copy');
		document.body.removeChild(input);
	}

	/**
	 *    Performs the default action for the SelectedElements
	 *
	 * @param {CategorizedCollection} SelectedElements    The elements selected by the user
	 * @param {MouseEvent} e                            The final event that completed activated the action
	 */
	ActUpon(SelectedElements, e) {
		switch(SelectedElements.GreatestType) {
			case CT_LINKS:
				// removing duplicates
				let links = Array.from(new Set(SelectedElements.Links.map((elem) => elem.href)));

				if(e.ctrlKey) {
					this.CopyToClipboard(links.join('\n'));
				} else {
					// For now we are simply going to create new tabs for the selected elements

					//noinspection JSUnresolvedVariable,JSUnresolvedFunction
					chrome.runtime.sendMessage(
						{
							Action: OPEN_URLS_IN_TABS,
							tUrls : links,
						});
				}
				break;
			case CT_CLICKABLE:
				for(let Button of SelectedElements.Clickable)
					Button.click();
				break;
			case CT_CHECKBOXES:
				// Determine majority checked/unchecked, prefers checking if counts are e
				let CheckedCount   = SelectedElements.Checkboxes.reduce((acc, elem) => acc + elem.checked, 0),
					UncheckedCount = SelectedElements.Checkboxes.length - CheckedCount,
					CheckElements  = UncheckedCount >= CheckedCount;

				for(let elem of SelectedElements.Checkboxes)
					elem.checked = CheckElements;
				break;
			case CT_RADIOBUTTONS:
				let GroupedByName = SelectedElements.RadioButtons.reduce((/** Map */ acc, elem) => {
					return acc.set(elem.name, (acc.get(elem.name) || []).concat([elem]));
				}, new Map());

				for(let [, tElems] of GroupedByName)
					tElems[0].checked = true;
				break;
		}
	}
});
