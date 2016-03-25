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

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseTestClass = (function () {
	_createClass(BaseTestClass, [{
		key: "elapsed",
		get: function get() {
			return (Date.now() - this.started) / 1000;
		}
	}]);

	function BaseTestClass() {
		_classCallCheck(this, BaseTestClass);
	}

	_createClass(BaseTestClass, [{
		key: "run",
		value: function run() {
			this.started = Date.now();
			this.runTest();
			this.completed();
		}
	}, {
		key: "runTest",
		value: function runTest() {
			throw new Error("BaseTestClass.runTest() should be over-ridden.");
		}
	}, {
		key: "completed",
		value: function completed() {
			throw new Error("BaseTestClass.completed() should be over-ridden.");
		}
	}, {
		key: "report",
		value: function report(name, count) {
			var elapsed = this.elapsed;
			console.log('SLP: %s: %6d in %6dms @ %10.0f/s', name, count, elapsed * 1000, count / elapsed);
		}
	}]);

	return BaseTestClass;
})();

var TestNodeFilter = (function () {
	function TestNodeFilter() {
		_classCallCheck(this, TestNodeFilter);
	}

	/**
  * Testing Class for testing speed of TreeWalker and NodeFilter
  *        Outputs the time it takes to count the nodes matched by the NodeFilter
  */

	_createClass(TestNodeFilter, [{
		key: "acceptNode",
		value: function acceptNode(node) {
			if (node.tagName == 'A') return NodeFilter.FILTER_ACCEPT;
			return NodeFilter.FILTER_SKIP;
		}
	}]);

	return TestNodeFilter;
})();

var TreeWalkerTest1 = (function (_BaseTestClass) {
	_inherits(TreeWalkerTest1, _BaseTestClass);

	function TreeWalkerTest1() {
		_classCallCheck(this, TreeWalkerTest1);

		_get(Object.getPrototypeOf(TreeWalkerTest1.prototype), "constructor", this).call(this);
		this.iter = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, new TestNodeFilter(), false);
		this.count = 0;
	}

	/**
  * Testing Class for testing speed of NodeIterator and NodeFilter
  *        Outputs the time it takes to count the nodes matched by the NodeFilter
  */

	_createClass(TreeWalkerTest1, [{
		key: "runTest",
		value: function runTest() {
			while (this.iter.nextNode()) {
				this.count++;
			}
		}
	}, {
		key: "completed",
		value: function completed() {
			this.report('      TreeWalkerTest', this.count);
		}
	}]);

	return TreeWalkerTest1;
})(BaseTestClass);

var NodeIteratorTest1 = (function (_BaseTestClass2) {
	_inherits(NodeIteratorTest1, _BaseTestClass2);

	function NodeIteratorTest1() {
		_classCallCheck(this, NodeIteratorTest1);

		_get(Object.getPrototypeOf(NodeIteratorTest1.prototype), "constructor", this).call(this);
		this.iter = document.createNodeIterator(document.documentElement, NodeFilter.SHOW_ELEMENT, new TestNodeFilter());
		this.count = 0;
	}

	/**
  * Testing Class for testing speed of QuerySelectorAll
  *        Outputs the time it takes to count the nodes using QuerySelectorAll
  */

	_createClass(NodeIteratorTest1, [{
		key: "runTest",
		value: function runTest() {
			while (this.iter.nextNode()) {
				this.count++;
			}
		}
	}, {
		key: "completed",
		value: function completed() {
			this.report('    NodeIteratorTest', this.count);
		}
	}]);

	return NodeIteratorTest1;
})(BaseTestClass);

var QuerySelectorTest1 = (function (_BaseTestClass3) {
	_inherits(QuerySelectorTest1, _BaseTestClass3);

	function QuerySelectorTest1() {
		_classCallCheck(this, QuerySelectorTest1);

		_get(Object.getPrototypeOf(QuerySelectorTest1.prototype), "constructor", this).call(this);
		this.count = 0;
	}

	_createClass(QuerySelectorTest1, [{
		key: "runTest",
		value: function runTest() {
			this.count = document.querySelectorAll('a').length;
		}
	}, {
		key: "completed",
		value: function completed() {
			this.report('   QuerySelectorTest', this.count);
		}
	}]);

	return QuerySelectorTest1;
})(BaseTestClass);

new ((function () {
	function PlaygroundEventHandler() {
		_classCallCheck(this, PlaygroundEventHandler);

		window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
		window.addEventListener('contextmenu', this.onContextMenu.bind(this), true);
		this.StopNextContextMenu = false;
	}

	_createClass(PlaygroundEventHandler, [{
		key: "onMouseDown",
		value: function onMouseDown(e) {
			/* Static use of no-modifiers down and right mouse button down */
			e.mods = e.ctrlKey + (e.altKey << 1) + (e.shiftKey << 2);

			if (e.buttons == RMB && e.mods == CTRL) {
				this.StopNextContextMenu = true;
				this.RunTests();
			}
		}
	}, {
		key: "onContextMenu",
		value: function onContextMenu(e) {
			if (this.StopNextContextMenu) {
				this.StopNextContextMenu = false;
				e.preventDefault();
			}
		}
	}, {
		key: "RunTests",
		value: function RunTests() {
			new TreeWalkerTest1().run();
			new NodeIteratorTest1().run();
			new QuerySelectorTest1().run();
		}
	}]);

	return PlaygroundEventHandler;
})())();

// class SLTesting {
// 	constructor() {
// 		console.log('SLTesting()');
// 		this.worker = new Worker(function() {
// 			onmessage = function(e) {
// 				console.log('function based worker');
// 			}
// 		});
//
// 		this.worker.postMessage({ action: 'test'});
// 		console.log('posted message');
// 	}
// }

//# sourceMappingURL=Playground-compiled.js.map