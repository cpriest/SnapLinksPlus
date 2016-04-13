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

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var RectMapper = (function () {
	function RectMapper() {
		_classCallCheck(this, RectMapper);

		this.ElemRects = new WeakMap();
	}

	/**
  * This class is responsible for:
  *  - Identifying/Tracking which elements in the document are selectable
  *  - Quickly filtering selectable elements by a document coordinate rect
  */

	/**
  * Gets the elements bounding rect(s) in document coordinates
  *
  * @param elem    HtmlElement    The element being requested
  * @param offset  object        The {x,y} offset the document is currently scrolled to (passed for performance reasons)
  * @returns {Rect}
  */

	_createClass(RectMapper, [{
		key: 'get',
		value: function get(elem, offset) {
			var Rects = this.ElemRects.get(elem);
			if (Rects) return Rects;

			Rects = this.GetElementRects(elem, offset);
			this.ElemRects.set(elem, Rects);
			return Rects;
		}

		/** Returns an array of { top, left, width, height } objects which combined make up the bounding rects of the given element,
   *    this uses the built-in .getClientRects() and additionally compensates for 'block' elements which it would appear is not
   *    handled appropriately for our needs by Mozilla or the standard
   */
	}, {
		key: 'GetElementRects',
		value: function GetElementRects(elem, offset) {
			offset = offset || { x: 0, y: 0 };

			var Rects = $A(elem.getClientRects());

			$A(elem.querySelectorAll('IMG')).forEach(function (elem) {
				Rects = Rects.concat($A(elem.getClientRects()));
			}, this);
			return Rects.map(function (rect) {
				return new Rect(rect.top + offset.y, rect.left + offset.x, rect.bottom + offset.y, rect.right + offset.x);
			});
		}
	}]);

	return RectMapper;
})();

var ElementIndexer = (function () {
	function ElementIndexer() {
		_classCallCheck(this, ElementIndexer);

		this.Anchors = document.querySelectorAll('A[href]');
		this.ElementRects = new RectMapper();

		this.UpdateIndex();
	}

	_createClass(ElementIndexer, [{
		key: 'UpdateIndex',
		value: function UpdateIndex() {
			var start = Date.now(),
			    elem = undefined,
			    idx = undefined,
			    docElem = document.documentElement,
			    scrollTop = docElem.scrollTop,
			    docHeight = docElem.scrollHeight,
			    Buckets = data.IndexBuckets;
			var offset = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };

			this.BoundaryIndex = [];
			for (var j = 0; j < Buckets; j++) this.BoundaryIndex[j] = [];

			//		@PerfTest
			//		var rr = new RateReporter('Calculated ${Count} Elements in ${Elapsed} (${PerSecond})');
			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = this.Anchors[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					elem = _step.value;

					/* GetBucketFromTop() */
					idx = Math.floor((elem.getBoundingClientRect().top + scrollTop) * Buckets / docHeight);
					if (this.BoundaryIndex[idx]) this.BoundaryIndex[idx].push(elem);
					//			@PerfTest
					//			this.ElementRects.get(elem, offset);
				}
				//		@PerfTest
				//		rr.report(this.Anchors.length);
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator['return']) {
						_iterator['return']();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}
		}

		/**
   *
   * @param SelectionRect
   */
	}, {
		key: 'Search',
		value: function Search(SelectionRect) {
			var docHeight = document.documentElement.scrollHeight,
			    Buckets = data.IndexBuckets,
			   
			/* GetBucketFromTop() */
			FirstBucket = Math.floor(SelectionRect.top * Buckets / docHeight),
			   
			/* GetBucketFromTop() */
			LastBucket = Math.floor(SelectionRect.bottom * Buckets / docHeight),
			    offset = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop },
			    tMatches = [];

			for (var j = FirstBucket; j <= LastBucket; j++) {
				var _iteratorNormalCompletion2 = true;
				var _didIteratorError2 = false;
				var _iteratorError2 = undefined;

				try {
					for (var _iterator2 = this.BoundaryIndex[j][Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
						var elem = _step2.value;
						var _iteratorNormalCompletion3 = true;
						var _didIteratorError3 = false;
						var _iteratorError3 = undefined;

						try {
							for (var _iterator3 = this.ElementRects.get(elem, offset)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
								var r = _step3.value;

								if (SelectionRect.intersects(r)) {
									tMatches.push(elem);
									break; // for(var r...
								}
							}
						} catch (err) {
							_didIteratorError3 = true;
							_iteratorError3 = err;
						} finally {
							try {
								if (!_iteratorNormalCompletion3 && _iterator3['return']) {
									_iterator3['return']();
								}
							} finally {
								if (_didIteratorError3) {
									throw _iteratorError3;
								}
							}
						}
					}
				} catch (err) {
					_didIteratorError2 = true;
					_iteratorError2 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion2 && _iterator2['return']) {
							_iterator2['return']();
						}
					} finally {
						if (_didIteratorError2) {
							throw _iteratorError2;
						}
					}
				}
			}
			return tMatches;
		}
	}]);

	return ElementIndexer;
})();

//# sourceMappingURL=ElementIndexer-compiled.js.map