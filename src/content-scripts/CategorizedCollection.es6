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

const CT_LINKS   = 'Links',
	  CT_BUTTONS = 'Buttons';

/**
 * This class categorizes a collection of selected elements and provide utilities around the collection of {Element}s
 *
 * @property {string}    GreatestType   The CT_* constant representing the greatest number of elements among the categories
 *
 * @property {Element[]} Links			The A elements in the collection
 * @property {Element[]} Buttons		The INPUT elements in the collection that are buttons
 */
class CategorizedCollection {

	/**
	 *
	 * @param {Element[]} tElems	The elements to categorize
	 */
	constructor(tElems = []) {
		this.CategorizeMatches(tElems);
	}

	/**
	 * An alias for the collection of the greatest number of elements among the categories
	 *
	 * @return {Element[]}
	 */
	get Greatest() { return this[this.GreatestType]; }

	/**
	 * An alias for returning a collection of all {Element}s in all categories
	 *
	 * @returns {Element[]}
	 */
	get All() { return this.Links.concat(this.Buttons); }

	/**
	 * Categorizes an array of HtmlElements by categories such as Links, Buttons, etc.
	 *
	 * @private
	 *
	 * @param {Element[]} tElems    The elements to categorize
	 */
	CategorizeMatches(tElems) {
		this.Links   = [];
		this.Buttons = [];

		for(let elem of tElems) {
			switch(elem.tagName) {
				case 'A':
					if(elem.href.length > 0)
						this.Links.push(elem);
					break;
				case 'INPUT':
					/** @var {HTMLInputElement} [elem] */
					if(['submit', 'reset', 'button'].indexOf(elem.type.toLowerCase()) !== -1) {
						this.Buttons.push(elem);
					}
					break;
			}
		}

		// Determine GreatestType
		let Counts        = new Map();
		Counts.set(CT_LINKS, this.Links.length);
		Counts.set(CT_BUTTONS, this.Buttons.length);

		let GreatestCount = 0;

		for(let [ t, c ] of Counts) {
			if(c > GreatestCount) {
				this.GreatestType = t;
				GreatestCount     = c;
			}
		}
	}
}
