"use strict";

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

class Rect {
	constructor(top, left, bottom, right) {
		[this.originTop, this.originLeft]              = [top, left];
		[this.top, this.left, this.bottom, this.right] = [top, left, bottom, right];
		this.CalculateProperties();
	}

	SetBottomRight(bottom, right) {
		[this.top, this.left]     = [Math.min(this.originTop, bottom), Math.min(this.originLeft, right)];
		[this.bottom, this.right] = [Math.max(this.originTop, bottom), Math.max(this.originLeft, right)];
		return this.CalculateProperties();
	}

	CalculateProperties() {
		this.width  = this.right - this.left;
		this.height = this.bottom - this.top;
		return this;
	}

	Expand(x, y) {
		[this.top, this.bottom] = [this.top - y, this.bottom + y];
		[this.left, this.right] = [this.left - x, this.right + x];
		return this.CalculateProperties();
	}

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

	ClipTo(r) {
		[this.top, this.left]     = [Math.max(this.top, r.top), Math.max(this.left, r.left)];
		[this.bottom, this.right] = [Math.min(this.bottom, r.bottom), Math.min(this.right, r.right)];
		return this.CalculateProperties();
	}

	toString() { return `{ top: ${this.top}, left: ${this.left}, bottom: ${this.bottom}, right: ${this.right}, width: ${this.width}, height: ${this.height} }`; }
}

class DocRect extends Rect {
	constructor(doc) {
		let docElem = document.documentElement;
		super(0, 0, docElem.scrollHeight, docElem.scrollWidth);
	}
}

class SelectionRect {
	constructor(top, left) {
		this.uiElem = CreateElement(
			'<div style="outline: 2px dashed rgba(0,255,0,1); transition: initial; position: absolute; z-index: 9999999; overflow: visible;" class="SL_SelRect">' +
			'	<div style="position: absolute; background: #FFFFD9; border: 1px solid black; border-radius: 2px; padding: 2px; font: normal 12px Verdana; white-space: nowrap;"></div>' +
			'</div>'
		);

		this.dims = new Rect(top, left, top, left);
		document.body.insertBefore(this.uiElem, document.body.firstElementChild);
	}

	SetBottomRight(bottom, right) {
		let dr = (new DocRect(document))
			.Expand(-2, -2);
		/* Based on current fixed style */
		this.dims
			.SetBottomRight(bottom, right)
			.ClipTo(dr);

		[this.uiElem.style.top, this.uiElem.style.left]     = [this.dims.top + 'px', this.dims.left + 'px'];
		[this.uiElem.style.height, this.uiElem.style.width] = [this.dims.height + 'px', this.dims.width + 'px'];

		this.uiElem.style.display = this.IsLargeEnoughToActivate()
			? ''
			: 'none';
	}

	SetCounter(count) {
		this.uiElem.firstElementChild.innerHTML = `${count} Links`;
	}

	AlignCounter(to_right, to_bottom) {
		let style = this.uiElem.firstElementChild.style;

		[style.right, style.left] =
			to_right
				? [0, '']
				: ['', 0];
		[style.bottom, style.top] =
			to_bottom
				? [0, '']
				: ['', 0];

		// move slightly to the right for not to be blocked by mouse pointer
		if(to_right == false && to_bottom == false) {
			style.left = '16px';
		}
	}

	Remove() {
		this.uiElem.remove();
		delete this.uiElem;
	}

	IsLargeEnoughToActivate() {
		return this.dims.width > data.selection.activate.minX || this.dims.height > data.selection.activate.minY;
	}
}

new (class EventHandler {
	constructor() {
		this.RegisterActivationEvents();
		this._onMouseUp     = this.onMouseUp.bind(this);
		this._onMouseMove   = this.onMouseMove.bind(this);
		this._onContextMenu = this.onContextMenu.bind(this);
		this._onKeyDown     = this.onKeyDown.bind(this);
		window.addEventListener('resize', _.throttle(this.onThrottledResize.bind(this), 100), true);
	}

	RegisterActivationEvents() {
		document.addEventListener('mousedown', this.onMouseDown.bind(this), true);
	}

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

	onMouseMove(e) { this.LastMouseEvent = e; }

	onMouseUp(e) {
		if(this.CurrentSelection.IsLargeEnoughToActivate())
			this.StopNextContextMenu();

		this.EndDrag(e);

		if(this.SelectedElements) {
			this.ActUpon(this.SelectedElements, e);
			delete this.SelectedElements;
		}
	}

	onKeyDown(e) {
		switch(e.key) {
			case 'Escape':
				this.EndDrag(e);
				break;
		}
	}

	onThrottledResize(e) {
		ElemDocRects.clear();

		if(this.SvgOverlay)
			this.SvgOverlay.Reposition();
	}

	onContextMenu(e) {
		window.removeEventListener('contextmenu', this._onContextMenu, true);
		e.preventDefault();
	}

	BeginDrag(e) {
		this.CurrentSelection = new SelectionRect(e.pageY, e.pageX);
		this.LastMouseEvent   = e;

		// Chrome doesn't support/need set/releaseCapture
		if(document.documentElement.setCapture)
			document.documentElement.setCapture(true);

		document.addEventListener('mouseup', this._onMouseUp, true);
		document.addEventListener('mousemove', this._onMouseMove, true);
		document.addEventListener('keydown', this._onKeyDown, true);
		this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
	}

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
			this.ElementIndexer = new ElementIndexer();
			this.SvgOverlay     = new SvgOverlay(data.HighlightStyles.ActOnElements);
		}
	}

	EndDrag(e) {
		document.removeEventListener('mouseup', this._onMouseUp, true);
		document.removeEventListener('mousemove', this._onMouseMove, true);
		document.removeEventListener('keydown', this._onKeyDown, true);

		if(this.mmTimer)
			this.mmTimer = clearInterval(this.mmTimer);

		if(this.CurrentSelection)
			this.CurrentSelection.Remove();

		if(this.SvgOverlay)
			this.SvgOverlay.destructor();

		delete this.CurrentSelection;
		delete this.ElementIndexer;
		delete this.SvgOverlay;
	}

	StopNextContextMenu() {
		window.addEventListener('contextmenu', this._onContextMenu, true);
	}

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
	 *
	 * @param {CategorizedCollection} SelectedElements    The elements selected by the user
	 * @param event
	 */
	ActUpon(SelectedElements, event) {
		switch(SelectedElements.GreatestType) {
			case CT_LINKS:
				// removing duplicates
				let links = Array.from(new Set(SelectedElements.Links.map((elem) => elem.href)));

				if(event.ctrlKey) {
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
				// Determine majority checked/unchecked, prefers checking if counts are event
				let CheckedCount = SelectedElements.Checkboxes.reduce((acc, elem) => acc + elem.checked, 0),
					UncheckedCount = SelectedElements.Checkboxes.length - CheckedCount,
					CheckElements = UncheckedCount >= CheckedCount;

				for(let elem of SelectedElements.Checkboxes)
					elem.checked = CheckElements;
				break;
			case CT_RADIOBUTTONS:
				break;
		}
	}
});
