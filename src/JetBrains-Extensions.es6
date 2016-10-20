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
Node.prototype.parentElement = 0;

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
