/*
 * Copyright (c) 2017 Clint Priest
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

/**
 * My own property I add to an event which is a bitfield of the modifier keys
 * @type {number}
 */
Event.prototype.mods = 0;

/**
 * My own stop event propagation/preventDefault wrapper
 */
Event.prototype.stop = function() { };


/**
 * @returns {DOMRect[]}
 */
Element.prototype.getClientRects = function() { };

/**
 * @type {Element|null}
 * @const
 */
Node.prototype.parentElement = null;

SVGRectElement = { };

chrome = {
	runtime: {
		sendMessage: function() {}
	}
};

///** @constructor */
//function console() {}
//
////noinspection JSPotentiallyInvalidConstructorUsage
///**
// * @browser Gecko
// * @param {string} profileName
// * @see https://developer.mozilla.org/en-US/docs/Web/API/Console/profile
// */
//console.prototype.profile = function(profileName) { };
//
////noinspection JSPotentiallyInvalidConstructorUsage
///**
// * @browser Gecko
// * @see https://developer.mozilla.org/en-US/docs/Web/API/Console/profileEnd
// */
//console.prototype.profileEnd = function() { };
//
