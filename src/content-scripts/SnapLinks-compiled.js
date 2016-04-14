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

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Rect = (function () {
	function Rect(top, left, bottom, right) {
		_classCallCheck(this, Rect);

		var _ref = [top, left];
		this.originTop = _ref[0];
		this.originLeft = _ref[1];
		var _ref2 = [top, left, bottom, right];
		this.top = _ref2[0];
		this.left = _ref2[1];
		this.bottom = _ref2[2];
		this.right = _ref2[3];

		this.calculateProperties();
	}

	_createClass(Rect, [{
		key: 'setBottomRight',
		value: function setBottomRight(bottom, right) {
			var _ref3 = [Math.min(this.originTop, bottom), Math.min(this.originLeft, right)];
			this.top = _ref3[0];
			this.left = _ref3[1];
			var _ref4 = [Math.max(this.originTop, bottom), Math.max(this.originLeft, right)];
			this.bottom = _ref4[0];
			this.right = _ref4[1];

			return this.calculateProperties();
		}
	}, {
		key: 'calculateProperties',
		value: function calculateProperties() {
			this.width = this.right - this.left;
			this.height = this.bottom - this.top;
			return this;
		}
	}, {
		key: 'expand',
		value: function expand(x, y) {
			var _ref5 = [this.top - y, this.bottom + y];
			this.top = _ref5[0];
			this.bottom = _ref5[1];
			var _ref6 = [this.left - x, this.right + x];
			this.left = _ref6[0];
			this.right = _ref6[1];

			return this.calculateProperties();
		}
	}, {
		key: 'intersects',
		value: function intersects(r) {
			/* Some/most of this code is duplicated from other parts of this class for performance reasons */

			// If the greatest top is higher than the lowest bottom, they don't intersect
			var GreatestTop = Math.max(this.top, r.top),
			    LowestBottom = Math.min(this.bottom, r.bottom);
			if (GreatestTop > LowestBottom) return false;

			// If the greatest left is higher than the lowest right, they don't intersect
			var GreatestLeft = Math.max(this.left, r.left),
			    LowestRight = Math.min(this.right, r.right);
			return GreatestLeft <= LowestRight;
		}
	}, {
		key: 'clipTo',
		value: function clipTo(r) {
			var _ref7 = [Math.max(this.top, r.top), Math.max(this.left, r.left)];
			this.top = _ref7[0];
			this.left = _ref7[1];
			var _ref8 = [Math.min(this.bottom, r.bottom), Math.min(this.right, r.right)];
			this.bottom = _ref8[0];
			this.right = _ref8[1];

			return this.calculateProperties();
		}
	}, {
		key: 'toString',
		value: function toString() {
			return '{ top: ' + this.top + ', left: ' + this.left + ', bottom: ' + this.bottom + ', right: ' + this.right + ', width: ' + this.width + ', height: ' + this.height + ' }';
		}
	}]);

	return Rect;
})();

var DocRect = (function (_Rect) {
	_inherits(DocRect, _Rect);

	function DocRect(doc) {
		_classCallCheck(this, DocRect);

		var docElem = document.documentElement;
		_get(Object.getPrototypeOf(DocRect.prototype), 'constructor', this).call(this, 0, 0, docElem.scrollHeight, docElem.scrollWidth);
	}

	return DocRect;
})(Rect);

var SelectionRect = (function () {
	function SelectionRect(top, left) {
		_classCallCheck(this, SelectionRect);

		this.uiElem = CreateElement('<div style="outline: 2px dashed rgba(0,255,0,1); position: absolute; z-index: 9999999;" class="SL_SelRect"></div>');
		this.dims = new Rect(top, left, top, left);
		document.body.insertBefore(this.uiElem, document.body.firstElementChild);
	}

	_createClass(SelectionRect, [{
		key: 'setBottomRight',
		value: function setBottomRight(bottom, right) {
			var dr = new DocRect(document).expand(-2, -2);
			/* Based on current fixed style */
			this.dims.setBottomRight(bottom, right).clipTo(dr);

			var _ref9 = [this.dims.top + 'px', this.dims.left + 'px'];
			this.uiElem.style.top = _ref9[0];
			this.uiElem.style.left = _ref9[1];
			var _ref10 = [this.dims.height + 'px', this.dims.width + 'px'];
			this.uiElem.style.height = _ref10[0];
			this.uiElem.style.width = _ref10[1];

			this.uiElem.style.display = this.IsLargeEnoughToActivate() ? '' : 'none';
		}
	}, {
		key: 'remove',
		value: function remove() {
			this.uiElem.remove();
			delete this.uiElem;
		}
	}, {
		key: 'IsLargeEnoughToActivate',
		value: function IsLargeEnoughToActivate() {
			return this.dims.width > data.selection.activate.minX && this.dims.height > data.selection.activate.minY;
		}
	}]);

	return SelectionRect;
})();

new ((function () {
	function EventHandler() {
		_classCallCheck(this, EventHandler);

		this.RegisterActivationEvents();
		this._onMouseUp = this.onMouseUp.bind(this);
		this._onMouseMove = this.onMouseMove.bind(this);
		this._onContextMenu = this.onContextMenu.bind(this);
	}

	_createClass(EventHandler, [{
		key: 'RegisterActivationEvents',
		value: function RegisterActivationEvents() {
			window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
		}
	}, {
		key: 'onMouseDown',
		value: function onMouseDown(e) {
			/* Static use of no-modifiers down and right mouse button down */
			e.mods = e.ctrlKey + (e.altKey << 1) + (e.shiftKey << 2);

			if (e.buttons == RMB) {
				switch (e.mods) {
					// @Development
					case CTRL + ALT:
						this.StopNextContextMenu();
						chrome.runtime.sendMessage({ Action: RELOAD_EXTENSION });
						break;

					case NONE:
						this.CurrentSelection = new SelectionRect(e.pageY, e.pageX);
						this.LastMouseEvent = e;
						document.documentElement.setCapture(true);
						window.addEventListener('mouseup', this._onMouseUp, true);
						window.addEventListener('mousemove', this._onMouseMove, true);
						this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
						break;
				}
			}
		}
	}, {
		key: 'onMouseMove',
		value: function onMouseMove(e) {
			this.LastMouseEvent = e;
		}
	}, {
		key: 'onMouseMoveInterval',
		value: function onMouseMoveInterval() {
			var e = this.LastMouseEvent,
			    docElem = document.documentElement;

			if (e) {
				this.IntervalScrollOffset = {
					x: e.clientX < 0 ? e.clientX : e.clientX > docElem.clientWidth ? e.clientX - docElem.clientWidth : 0,
					y: e.clientY < 0 ? e.clientY : e.clientY > docElem.clientHeight ? e.clientY - docElem.clientHeight : 0
				};

				this.MousePos = { clientX: e.clientX, clientY: e.clientY };
				delete this.LastMouseEvent;
			}

			docElem.scrollLeft += this.IntervalScrollOffset.x;
			docElem.scrollTop += this.IntervalScrollOffset.y;

			/* Set our bottom right to scroll + max(clientX/Y, clientWidth/Height) */
			this.CurrentSelection.setBottomRight(docElem.scrollTop + Math.min(this.MousePos.clientY, docElem.clientHeight), docElem.scrollLeft + Math.min(this.MousePos.clientX, docElem.clientWidth));

			if (this.ElementIndexer) {
				this.ElementHighlighter.Highlight(this.SelectedElements = this.ElementIndexer.Search(this.CurrentSelection.dims));
			} else if (this.CurrentSelection.IsLargeEnoughToActivate()) {
				this.ElementIndexer = new ElementIndexer();
				this.ElementHighlighter = new ElementHighlighter();
			}
		}
	}, {
		key: 'onMouseUp',
		value: function onMouseUp(e) {
			window.removeEventListener('mouseup', this._onMouseUp, true);

			clearInterval(this.mmTimer);
			delete this.mmTimer;

			window.removeEventListener('mousemove', this._onMouseMove, true);
			this.CurrentSelection.IsLargeEnoughToActivate() && this.StopNextContextMenu();
			this.CurrentSelection.remove();
			delete this.CurrentSelection;
			delete this.ElementIndexer;

			this.ActUpon(this.SelectedElements, e);
			delete this.SelectedElements;

			this.ElementHighlighter.Unhighlight();
			delete this.ElementHighlighter;

			document.releaseCapture();
		}
	}, {
		key: 'StopNextContextMenu',
		value: function StopNextContextMenu() {
			window.addEventListener('contextmenu', this._onContextMenu, true);
		}
	}, {
		key: 'onContextMenu',
		value: function onContextMenu(e) {
			window.removeEventListener('oncontextmenu', this._onContextMenu, true);
			e.preventDefault();
		}
	}, {
		key: 'ActUpon',
		value: function ActUpon(tElems) {
			// For now we are simply going to create new tabs for the selected elements
			chrome.runtime.sendMessage({
				Action: OPEN_URLS_IN_TABS,
				tUrls: tElems.map(function (elem) {
					return elem.href;
				})
			});
		}
	}]);

	return EventHandler;
})())();

//# sourceMappingURL=SnapLinks-compiled.js.map