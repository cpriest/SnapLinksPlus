/*
 *  Copyright (C) 2011  Clint Priest
 *  
 *  This file is part of Snap Links.
 *
 *  Snap Links is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links.  If not, see <http://www.gnu.org/licenses/>.
 */

/* Utility */
function Log() { Firebug.Console.logFormatted(arguments); }

/** Stripped down (non inheriting version of prototype classes, allows for getters/setters including c# style getters/setters */
var Class = (function() {
	function create() {
		function klass() {
			this.initialize.apply(this, arguments);
		}
		
		klass.addMethods = Class.Methods.addMethods;
		
		for (var i = 0; i < arguments.length; i++)
			klass.addMethods(arguments[i]);

		if (!klass.prototype.initialize)
			klass.prototype.initialize = function() { };

		return klass;
	}

	function addMethods(source) {
		var properties = Object.keys(source);

		for (var i = 0, length = properties.length; i < length; i++) {
			var property = properties[i];
			
			var Setter = source.__lookupSetter__(property),
				Getter = source.__lookupGetter__(property);

			if(Setter)
				this.prototype.__defineSetter__(property, Setter);
			if(Getter)
				this.prototype.__defineGetter__(property, Getter);

			if(Setter == undefined && Getter == undefined) {

				/* Support Name: { get: function(), set: function() } syntax, ala C# getter/setter syntax */
				var Descriptor = source[property];
				if(Descriptor && typeof Descriptor == 'object' && (Descriptor.get || Descriptor.set)) {
					if(Descriptor.set)
						this.prototype.__defineSetter__(property, Descriptor.set);
					if(Descriptor.get)
						this.prototype.__defineGetter__(property, Descriptor.get);
				} else {
					this.prototype[property] = source[property];
				}
			}
		}
		return this;
	}

	return {
		create: create,
		Methods: {
			addMethods: addMethods
		}
	};
})();

/* Converts an iterable element to an array */
function $A(iterable) {
	if (!iterable) return [];
	if ('toArray' in Object(iterable)) return iterable.toArray();
	var length = iterable.length || 0, results = new Array(length);
	while (length--) results[length] = iterable[length];
	return results;
}

/** Returns an array of { top, left, width, height } objects which combined make up the bounding rects of the given element, 
* 	this uses the built-in .getClientRects() and additionally compensates for 'block' elements which it would appear is not
* 	handled appropriately for our needs by Mozilla or the standard 
*/
function GetElementRects(node, offset) {
	offset = offset || { x: 0, y: 0 };
	
	var Rects = $A(node.getClientRects());
	
	$A(node.querySelectorAll('IMG')).forEach( function(elem) {
		Rects = Rects.concat( $A(elem.getClientRects()) );
	} );
	return Rects.map( function(rect) {
		return { 	top		: rect.top + offset.y, 
					left	: rect.left + offset.x, 
					bottom	: rect.top + rect.height + offset.y, 
					right	: rect.left + rect.width + offset.x };
	} );
}

function ApplyStyle(elem, style) {
	var OriginalStyle = { };
	Object.keys(style).forEach( function(name) {
		OriginalStyle[name] = elem.style[name];
		elem.style[name] = style[name];
	} );
	return OriginalStyle;
}
