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
 * This class is responsible for:
 *  - Identifying/Tracking which elements in the document are selectable
 *  - Quickly filtering selectable elements by a rect
 *
 *  @plan
 *    Current plan for 'quickly' filtering selectable elements is to index by element.getClientBoundingRect().top divided into N buckets
 */
class ElementHighlighter {
	constructor() {
		this.HighlightedElements = [];
	}

	Highlight(tElems) {
		let tPrevElems  = this.HighlightedElements,
			Unhighlight = tPrevElems.filter(
				(elem) => { return !tElems.includes(elem); }
			),
			Highlight   = tElems.filter(
				(elem) => { return !tPrevElems.includes(elem); }
			);
		for(let elem of Unhighlight)
			elem.style.outline = '';
		for(let elem of Highlight)
			elem.style.outline = '1px solid red';
		this.HighlightedElements = tElems;
	}

	Unhighlight() {
		for(var elem of this.HighlightedElements) {
			elem.style.outline = '';
		}
		this.HighlightedElements = [];
	}
}

