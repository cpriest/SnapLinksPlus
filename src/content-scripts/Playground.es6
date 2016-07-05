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

class BaseTestClass {
	get elapsed() { return (Date.now() - this.started) / 1000; }

	constructor() {

	}

	run() {
		this.started = Date.now();
		this.runTest();
		this.completed();
	}

	runTest() {
		throw new Error("BaseTestClass.runTest() should be over-ridden.");
	}

	completed() {
		throw new Error("BaseTestClass.completed() should be over-ridden.");
	}

	report(name, count) {
		let elapsed = this.elapsed;
		console.log('SLP: %s: %6d in %6dms @ %10.0f/s', name, count, elapsed * 1000, count / elapsed);
	}
}

class TestNodeFilter {
	acceptNode(node) {
		if(node.tagName == 'A')
			return NodeFilter.FILTER_ACCEPT;
		return NodeFilter.FILTER_SKIP;
	}
}

/**
 * Testing Class for testing speed of TreeWalker and NodeFilter
 *        Outputs the time it takes to count the nodes matched by the NodeFilter
 */
class TreeWalkerTest1 extends BaseTestClass {
	constructor() {
		super();
		this.iter  = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT, new TestNodeFilter(), false);
		this.count = 0;
	}

	runTest() {
		while(this.iter.nextNode()) {
			this.count++;
		}
	}

	completed() {
		this.report('      TreeWalkerTest', this.count);
	}
}

/**
 * Testing Class for testing speed of NodeIterator and NodeFilter
 *        Outputs the time it takes to count the nodes matched by the NodeFilter
 */
class NodeIteratorTest1 extends BaseTestClass {
	constructor() {
		super();
		this.iter  = document.createNodeIterator(document.documentElement, NodeFilter.SHOW_ELEMENT, new TestNodeFilter());
		this.count = 0;
	}

	runTest() {
		while(this.iter.nextNode()) {
			this.count++;
		}
	}

	completed() {
		this.report('    NodeIteratorTest', this.count);
	}
}

/**
 * Testing Class for testing speed of QuerySelectorAll
 *        Outputs the time it takes to count the nodes using QuerySelectorAll
 */
class QuerySelectorTest1 extends BaseTestClass {
	constructor() {
		super();
		this.count = 0;
	}

	runTest() {
		this.count = document.querySelectorAll('a').length;
	}

	completed() {
		this.report('   QuerySelectorTest', this.count);
	}
}

new (class PlaygroundEventHandler {
	constructor() {
		window.addEventListener('mousedown', this.onMouseDown.bind(this), true);
		window.addEventListener('contextmenu', this.onContextMenu.bind(this), true);
		this.StopNextContextMenu = false;
	}

	onMouseDown(e) {
		/* Static use of no-modifiers down and right mouse button down */
		e.mods = (e.ctrlKey) + (e.altKey << 1) + (e.shiftKey << 2);

		if(e.buttons == RMB && e.mods == CTRL) {
			this.StopNextContextMenu = true;
			this.RunTests();
		}
	}

	onContextMenu(e) {
		if(this.StopNextContextMenu) {
			this.StopNextContextMenu = false;
			e.preventDefault();
		}
	}

	RunTests() {
		(new TreeWalkerTest1()).run();
		(new NodeIteratorTest1()).run();
		(new QuerySelectorTest1()).run();
	}
});


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
