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
 * Handy shortcut for creating an element or element tree
 *
 * @param {string} html		Raw HTML to be used for creating the nodes
 *
 * @returns {Element}
 */
function CreateElement(html) {
	let DocFrag = document.createDocumentFragment();
	let result;

	DocFrag.appendChild(document.createElement('div'));
	DocFrag.firstChild.innerHTML = html;
	result                       = DocFrag.firstElementChild.firstElementChild;
	result.remove();

	return result;
}

/**
 * Returns a string of the given properties, like propName: propValue
 *
 * @param {object}		obj		The object to inspect
 * @param {string[]}	props	The properties to include
 */
function dir(obj, props) {
	let out = [];
	if(typeof obj != 'object')
		return 'dir(): not an object';

	for(let prop of props)
		out.push(prop + ': ' + obj[ prop ]);
	return out.join(', ');
}

/**
 * Class which provides for timing and metrics / elapsed time with output
 *    controlled via delayed template literal
 */
class RateReporter {
	/**
	 *
	 * @param {string}	msg     Template literal which should be passed as a string, when reporting
	 *                    		the following variables are available to the template:
	 *                       		Count:            The count variable passed in to report()
	 *                        		PerSecond:        The Count / Second rate
	 *                        		Elapsed:        The time that has elapsed
	 */
	constructor(msg) {
		this.msg     = msg;
		this.started = Date.now();
	}

	/**
	 * Report the results of the timing
	 *
	 * @param {int}	Count	The number of operations performed
	 */
	report(Count) {
		let ElapsedMS = (Date.now() - this.started),
			ElapsedS  = ElapsedMS / 1000,
			Elapsed;

		// Function to resolve template literal
		let z = new Function('Count', 'PerSecond', 'Elapsed', 'return `' + this.msg + '`');

		// Show ms if less than 1 second, otherwise seconds rounded to two places
		Elapsed = ElapsedMS < 1000
			? ElapsedMS + 'ms'
			: (Math.round(ElapsedS * 100) / 100) + 's';

		console.log(z(Count, (Math.round(Count / ElapsedS * 100) / 100) + '/s', Elapsed));
	}
}

/**
 * Converts an iterable element to an array.
 *
 * @param {Array|object|} iterable	Any iterable arrayLike object
 *
 * @return {Array}
 */
function $A(iterable) { return Array.from(iterable); }

/**
 * Adds a mods bitfield to an event based on ctrlKey, altKey and shiftKey states
 *
 * @param {MouseEvent|KeyboardEvent} e
 * @returns {MouseEvent|KeyboardEvent}
 */
function AddModsToEvent(e) {
	e.mods = (e.ctrlKey) + (e.altKey << 1) + (e.shiftKey << 2);
	return e;
}
