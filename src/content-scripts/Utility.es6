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

function CreateElement(html) {
	let DocFrag = document.createDocumentFragment();
	let result;

	DocFrag.appendChild(document.createElement('div'));
	DocFrag.firstChild.innerHTML = html;
	result                       = DocFrag.firstChild.firstChild;
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
	let out = [];
	if(typeof obj != 'object')
		return 'dir(): not an object';

	for(let prop of props)
		out.push(prop + ': ' + obj[ prop ]);
	return out.join(', ');
}
