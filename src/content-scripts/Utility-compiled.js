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

function CreateElement(html) {
	var DocFrag = document.createDocumentFragment();
	var result = undefined;

	DocFrag.appendChild(document.createElement('div'));
	DocFrag.firstChild.innerHTML = html;
	result = DocFrag.firstChild.firstChild;
	result.parentNode.removeChild(result);
	return result;
}

/**
 * Returns a string of the given properties, like propName: propValue
 *
 * @param obj
 * @param props
 */
function dir(obj, props) {
	var out = [];
	if (typeof obj != 'object') return 'dir(): not an object';

	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = props[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var prop = _step.value;

			out.push(prop + ': ' + obj[prop]);
		}
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

	return out.join(', ');
}

/**
 * Class which provides for timing and metrics / elapsed time with output
 *    controlled via delayed template literal
 */

var RateReporter = (function () {
	/**
  *
  * @param msg         Template literal which should be passed as a string, when reporting
  *                    the following variables are available to the template:
  *                        Count:            The count variable passed in to report()
  *                        PerSecond:        The Count / Second rate
  *                        Elapsed:        The time that has elapsed
  * @param options
  */

	function RateReporter(msg, options) {
		_classCallCheck(this, RateReporter);

		this.msg = msg;
		this.options = options;
		this.started = Date.now();
	}

	/**
  * Converts an iterable element to an array.
  */

	/**
  * Report the results of the timing
  * @param Count
  */

	_createClass(RateReporter, [{
		key: 'report',
		value: function report(Count) {
			var ElapsedMS = Date.now() - this.started,
			    ElapsedS = ElapsedMS / 1000,
			    Elapsed = undefined;

			// Function to resolve template literal
			var z = new Function('Count', 'PerSecond', 'Elapsed', 'return `' + this.msg + '`');

			// Show ms if less than 1 second, otherwise seconds rounded to two places
			Elapsed = ElapsedMS < 1000 ? ElapsedMS + 'ms' : Math.round(ElapsedS * 100) / 100 + 's';

			console.log(z(Count, Math.round(Count / ElapsedS * 100) / 100 + '/s', Elapsed));
		}
	}]);

	return RateReporter;
})();

function $A(iterable) {
	if (!iterable) return [];
	if ('toArray' in Object(iterable)) return iterable.toArray();
	var length = iterable.length || 0,
	    results = new Array(length);
	while (length--) results[length] = iterable[length];
	return results;
}

//# sourceMappingURL=Utility-compiled.js.map
