/*
 *  Utility.js
 *
 *  Copyright (C) 2011, 2012  Clint Priest, Tommi Rautava
 *
 *  This file is part of Snap Links Plus.
 *
 *  Snap Links Plus is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links Plus is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var EXPORTED_SYMBOLS = ['Class',
						'PrefsDialogMapper',
						'Util',
						'$A',
						'ApplyStyle',
						'GetElementRects',
						'Rect',
						'htmlentities',
						'escapeHTML',
						'console',
						'dc',
						'DumpWindowFrameStructure',
						'UpdatePreferences',
						'MaxDocValue',
						'CreatePreferenceMap',
						'CreateAnonymousElement',
						'XULNS',
						'Point',
						'sprintf',
						'usn',
						'CapCallFrequency',
						'KeyEvent',
						'Unloader',
						'PromiseLoadFile',
						'PromiseLoadDocument',
						'devtools',
						'BootstrapMgr'];

let { Constructor: CC, classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/devtools/Loader.jsm");
Cu.import("resource://gre/modules/devtools/Console.jsm");

let XULNS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
	KeyEvent = Ci.nsIDOMKeyEvent;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import("resource://gre/modules/devtools/Console.jsm");
Cu.import('resource://gre/modules/Geometry.jsm');
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import('chrome://snaplinksplus/content/sprintf.js');
Cu.import('chrome://snaplinksplus/content/WindowFaker.js');

Point.prototype.toString = function () {
	//noinspection JSCheckFunctionSignatures
	return sprintf('( %8.1f, %8.1f )', this.x, this.y);
};

var dc = function () { };

/**
 * Loads files via Cu.import and tracks files loaded so they can be
 *    unloaded during shutdown()
 */
var Unloader = {
	LoadedFiles: new Set(),

	load  : function load(URL) {
		Cu.import(URL);
		this.LoadedFiles.add(URL);
	},
	unload: function unload() {
		for (let URL of this.LoadedFiles.values())
			Cu.unload(URL);
	}
};

if(Services.prefs.getPrefType('extensions.snaplinks.Dev.Mode') && Services.prefs.getBoolPref('extensions.snaplinks.Dev.Mode') == true) {
	console.warn("Warning, console.clear() is being over-ridden/created (at this time, it's defined but empty, may have changed.)");
	console.clear = function() {
		try {
			devtools.require("devtools/webconsole/hudservice").getBrowserConsole().jsterm.clearOutput();
		} catch (e) { }
	};

	dc = function() {
		let args = Array.prototype.slice.call(arguments, 0),
			channel = args.shift(),
			PrefsRoot = 'extensions.snaplinks.Debug.Channel.';//.'+channel+'.show';

		Services.prefs.getDefaultBranch(PrefsRoot).setBoolPref(channel+'.show', false);
		if(Services.prefs.getBranch(PrefsRoot).getBoolPref(channel+'.show') != true)
			return;

		if(typeof args[0] == 'function') {
			var olf = console.log;
			console.log = function() {
				let args = Array.prototype.slice.call(arguments, 0);
				args[0] = channel+': '+args[0];
				olf.apply(console, args);
			};
			args[0]();
			console.log = olf;
		} else {
			args[0] = channel+': '+args[0];
			console.log.apply(console, args);
		}
	}
}
/**
 * Prototype Imports -- Mozilla Organization may not like these...
 */
var Util = {
	Object: {
		/**
		 * Returns true if object is a function.
		 */
		isFunction: function(object) {
			return typeof object === 'function';
		},

		/**
		 * Extends the destination object with properties
		 * from the source object.
		 */
		extend: function(destination, source) {
			for (var property in source)
				destination[property] = source[property];
			return destination;
		},
		wrap: function(base, methods) {
			var o = { };
			Util.Object.extend(o, methods);
			o.__proto__ = base;
			o.wrap = function(base) { return Util.Object.wrap(base, methods); };
			return o;
		},
	},

	Function: {
		/**
		 * Returns an array of the argument names to the given function.
		 */
		ArgumentNames: function(func) {
			var names = func.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
							.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
							.replace(/\s+/g, '').split(',');
			return names.length == 1 && !names[0] ? [] : names;
		},

		/**
		 * Returns the given func wrapped with wrapper.
		 */
		Wrap: function(func, wrapper) {
			/**
			 * Localized version of Function.update from prototype.
			 */
			function update(array, args) {
				var arrayLength = array.length;
				var length = args.length;

				while (length--) array[arrayLength + length] = args[length];
				return array;
			}

			var __method = func;

			return function() {
				var a = update([__method.bind(this)], arguments);
				return wrapper.apply(this, a);
			};
		}
	}
};

/**
 * Fully functioning prototype class inheritance, also allows for getters/setters including c# style getters/setters
 **/
var Class = (function() {
	function subclass() {};

	function create() {

		var parent = null, properties = $A(arguments);
		if (Util.Object.isFunction(properties[0]))
			parent = properties.shift();

		function klass() {
			this.initialize.apply(this, arguments);
		}

		klass.superclass = parent;
		klass.subclasses = [];

		klass.addMethods = Class.Methods.addMethods;

		if (parent) {
			subclass.prototype = parent.prototype;
			klass.prototype = new subclass;
			parent.subclasses.push(klass);
		}

		for (var i = 0; i < arguments.length; i++)
			klass.addMethods(arguments[i]);

		if (!klass.prototype.initialize)
			klass.prototype.initialize = function() { };

		klass.prototype.constructor = klass;
		return klass;
	}

	function addMethods(source) {
		var ancestor   = this.superclass && this.superclass.prototype;
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
				var value = source[property];
				if(value && typeof value == 'object' && (value.get || value.set)) {
					if(value.set)
						this.prototype.__defineSetter__(property, value.set);
					if(value.get)
						this.prototype.__defineGetter__(property, value.get);
				} else {
					if (ancestor && Util.Object.isFunction(value) && Util.Function.ArgumentNames(value)[0] == "$super") {
						var method = value;
						value = Util.Function.Wrap(
							(function(m) {
								return function() { return ancestor[m].apply(this, arguments); };
							})(property), method
						);

						value.valueOf = method.valueOf.bind(method);
						value.toString = method.toString.bind(method);
					}
					this.prototype[property] = value;
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

/**
 * Converts an iterable element to an array.
 */
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
	}, this );
	return Rects.map( function(rect) {
		return new Rect(rect.top + offset.y, rect.left + offset.x,
						rect.top + rect.height + offset.y, rect.left + rect.width + offset.x);
	} );
}

/**
 * Applies the given style to the given element
 * returns a hash of what changed styles were originally.
 */
function ApplyStyle(elem, style) {
	var OriginalStyle = { };
	Object.keys(style).forEach( function(name) {
		OriginalStyle[name] = elem.style[name];
		elem.style[name] = style[name];
	}, this);
	return OriginalStyle;
}

/**
 * Dumps the win.frames and sub-frame.frames structure recursively
 */
function DumpWindowFrameStructure(win) {
	var path = ['0'];

	function dump(win) {
		console.log('%s: %s, %o, (%d, %d)', path.join('.'), win.document.URL, win, win.mozInnerScreenX-win.top.mozInnerScreenX, win.mozInnerScreenY-win.top.mozInnerScreenY);
		for(var j=0;j<win.frames.length;j++) {
			path.push(j);
			dump(win.frames[j]);
			path.pop();
		}
	}

	dump(win);
}

/**
 * Creates our own copy of Services.prefs with added functions and over-rides
 * of getBranch/getDefaultBranch which return wrapped objects as well.
 */
var PrefsServiceExtensions = {
	/* Type-agnostic GetPref */
	GetPref: function GetPref(SubPath) {
		switch(this.getPrefType(SubPath)) {
			case this.PREF_STRING:	return this.getCharPref(SubPath);
			case this.PREF_INT:		return this.getIntPref(SubPath);
			case this.PREF_BOOL:	return this.getBoolPref(SubPath);
		}
		return undefined;
	},

	/* Type-agnostic SetPref */
	SetPref: function SetPref(SubPath, Value) {
		if(Value == undefined)
			return this.clearUserPref(SubPath);

		switch(typeof Value) {
			case 'boolean':	return this.setBoolPref(SubPath, Value);
			case 'number':	return this.setIntPref(SubPath, Value);
			case 'string':	return this.setCharPref(SubPath, Value);
		}
		return false;
	},

	getBranch: function getBranchProxy(root) { return this.wrap(Services.prefs.getBranch(root)); },
	getDefaultBranch: function getDefaultBranchProxy(root) { return this.wrap(Services.prefs.getDefaultBranch(root)); },
};
var Prefs = Util.Object.wrap(Services.prefs, PrefsServiceExtensions);

/**
 * Returns an object who's properties match the structure of Defaults,
 * 		each property will have an accessor defined which will get/set the value
 * 		from within the preferences branch
 *
 * @param BasePath	The base branch in the preferences where all properties exist under
 * @param Defaults	An object map of properties and defaults, all entries in the map are set on the default preferences branch
 * @returns {*}
 */
function CreatePreferenceMap(BasePath, Defaults) {
	var PrefsBranch = Prefs.getDefaultBranch(BasePath);

	function WalkObject(o, sub) {
		let obj = { };
		let props = { };

		for(let [name, value] in Iterator(o)) {
			let path = [sub, name].join('.');
			if(typeof value == 'object') {
				obj[name] = WalkObject(value, path);
			} else {
				PrefsBranch.SetPref(path, value);
				props[name] = {
					enumerable: true,
					get: function() { return PrefsBranch.GetPref(path); },
					set: function(x) { return PrefsBranch.SetPref(path, x); }
				}
			}
		}
		Object.defineProperties(obj, props);
		return obj;
	}

	let obj = WalkObject(Defaults, undefined);

	/* Set PrefsBranch to non-default branch for future access */
	PrefsBranch = Prefs.getBranch(BasePath);

	return obj;
}

/**
 * Updates & Translates user preferences according to the Updates hash
 *
 * @param BasePath	The base path in the preferences branch
 * @param Updates	A hash of SubPath: {Translation}
 * 						If {Translation} is a string, then it moves any userPref from the old location to the new location (same BasePath)
 * 						If {Translation} is an object, then properties:
 * 							.Location	- New location of the user preference
 * 							.Translate	- Hash of OldValue: NewValue to translate
 *
 */
function UpdatePreferences(BasePath, Updates) {
	function MoveUserPreference(From, To) {
		From = [BasePath, From].join('.');
		To = [BasePath, To].join('.');
		if(Prefs.prefHasUserValue(From)) {
			Prefs.SetPref(To, Prefs.GetPref(From));
			Prefs.SetPref(From, undefined);
		}
	}

	function TranslateUserPreference(Path, Map) {
		Path = [BasePath, Path].join('.');
		if(Prefs.prefHasUserValue(Path)) {
			let v = Prefs.GetPref(Path);
			if(v && v in Map)
				Prefs.SetPref(Path, Map[v]);
		}
	}

	for(let [name, value] in Iterator(Updates)) {
		let Location = value;
		if(typeof value == 'object') {
			if('Translate' in value)
				TranslateUserPreference(name, value.Translate);
			if('MoveTo' in value)
				MoveUserPreference(name, value.MoveTo);
		} else
			MoveUserPreference(name, value);
	}
}

/*
 * @TODO - Merge my Rect with MDN base rect
 */

var Rect = Class.create({
	initialize:function(top, left, bottom, right) {
		this.__top = this.__left = this.__right = this.__bottom = 0;
		/* __top stores set top, _top stores non-inverted top, likewise for left, bottom, right */
		if(typeof top == 'object') {
			left = top.left;
			bottom = top.bottom;
			right = top.right;
			top = top.top;
		}
		this.top = top;
		this.left = left;
		this.bottom = bottom || top;
		this.right = right || left;
	},
	get top()       { return this._top;	},
	set top(top)    {
		this.__top = top;
		[this._top, this._bottom] = this.__top < this.__bottom
			? [this.__top, this.__bottom ]
			: [this.__bottom, this.__top ];
	},

	get left()      { return this._left; },
	set left(left)  {
		this.__left = left;
		[this._left, this._right] = this.__left < this.__right
			? [this.__left, this.__right ]
			: [this.__right, this.__left ];
	},

	get bottom()    { return this._bottom; },
	set bottom(bottom) {
		this.__bottom = bottom;
		[this._top, this._bottom] = this.__top < this.__bottom
			? [this.__top, this.__bottom ]
			: [this.__bottom, this.__top ];
	},

	get right()     { return this._right; },
	set right(right) {
		this.__right = right;
		[this._left, this._right] = this.__left < this.__right
			? [this.__left, this.__right ]
			: [this.__right, this.__left ];
	},

	get width()     { return this._right - this._left; },
	get height()    { return this._bottom - this._top; },

	get IsInverted() { return this.IsInvertedX || this.IsInvertedY; },
	get IsInvertedX() { return this.__left > this.__right; },
	get IsInvertedY() { return this.__top > this.__bottom; },

	get area() { return this.width * this.height; },

	clone: function() { return new Rect(this._top, this._left, this._bottom, this._right); },

	scale: function(x, y) {
		this.__left *= x;	this._left *= x;
		this.__right *= x;	this._right *= x;
		this.__top *= y;	this._top *= y;
		this.__bottom *= y;	this._bottom *= y;

		return this;
	},

	Offset:function(x, y) {
		this.__left += x;	this._left += x;
		this.__right += x;	this._right += x;
		this.__top += y;	this._top += y;
		this.__bottom += y;	this._bottom += y;

		return this;
	},
	Shrink:function(x, y) {
		this.__left += x;	this._left += x;
		this.__right -= x;	this._right -= x;
		this.__top += y;	this._top += y;
		this.__bottom -= y;	this._bottom -= y;

		return this;
	},
	Expand: function(x, y) {
		this.Shrink(-x, -y);

		return this;
	},
	intersect: function(r) { return this.GetIntersectRect(r); },
	intersects: function(r) { return this.IntersectsWith(r); },
	GetIntersectRect: function(r) {
		if(!this.intersects(r))
			return false;
		return new Rect(Math.max(this._top, r._top), Math.max(this._left, r._left),
							Math.min(this._bottom, r._bottom), Math.min(this._right, r._right));
	},
	IntersectsWith: function(r) {
		/* Some/most of this code is duplicated from other parts of this class for performance reasons */

		// If the greatest top is higher than the lowest bottom, they don't intersect
		let GreatestTop = Math.max(this._top, r._top),
			LowestBottom = Math.min(this._bottom, r._bottom);
		if(GreatestTop > LowestBottom)
			return false;

		// If the greatest left is higher than the lowest right, they don't intersect
		let GreatestLeft = Math.max(this._left, r._left),
			LowestRight = Math.min(this._right, r._right);
		return GreatestLeft <= LowestRight;

	},
	toString: function() {
		//noinspection JSCheckFunctionSignatures
		return sprintf('{t:%5d, l:%5d, b:%5d, r:%5d, %5dx%-5d}', this._top, this._left, this._bottom, this._right, this.width, this.height);
	}
});

function get_html_translation_table (table, quote_style) {
	// Returns the internal translation table used by htmlspecialchars and htmlentities
	//
	// version: 1109.2015
	// discuss at: http://phpjs.org/functions/get_html_translation_table    // +   original by: Philip Peterson
	// +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +   bugfixed by: noname
	// +   bugfixed by: Alex
	// +   bugfixed by: Marco    // +   bugfixed by: madipta
	// +   improved by: KELAN
	// +   improved by: Brett Zamir (http://brett-zamir.me)
	// +   bugfixed by: Brett Zamir (http://brett-zamir.me)
	// +      input by: Frank Forte    // +   bugfixed by: T.Wild
	// +      input by: Ratheous
	// %          note: It has been decided that we're not going to add global
	// %          note: dependencies to php.js, meaning the constants are not
	// %          note: real constants, but strings instead. Integers are also supported if someone    // %          note: chooses to create the constants themselves.
	// *     example 1: get_html_translation_table('HTML_SPECIALCHARS');
	// *     returns 1: {'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'}
	var entities = {},
		hash_map = {},        decimal;
	var constMappingTable = {},
		constMappingQuoteStyle = {};
	var useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS',
		useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() : 'ENT_COMPAT';
	// Translate arguments
	constMappingTable[0] = 'HTML_SPECIALCHARS';
	constMappingTable[1] = 'HTML_ENTITIES';
	constMappingQuoteStyle[0] = 'ENT_NOQUOTES';    constMappingQuoteStyle[2] = 'ENT_COMPAT';
	constMappingQuoteStyle[3] = 'ENT_QUOTES';

	if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
		throw new Error("Table: " + useTable + ' not supported');
		// return false;
	}
	entities['38'] = '&amp;';
	if (useTable === 'HTML_ENTITIES') {
		entities['160'] = '&nbsp;';
		entities['161'] = '&iexcl;';        entities['162'] = '&cent;';
		entities['163'] = '&pound;';
		entities['164'] = '&curren;';
		entities['165'] = '&yen;';
		entities['166'] = '&brvbar;';        entities['167'] = '&sect;';
		entities['168'] = '&uml;';
		entities['169'] = '&copy;';
		entities['170'] = '&ordf;';
		entities['171'] = '&laquo;';        entities['172'] = '&not;';
		entities['173'] = '&shy;';
		entities['174'] = '&reg;';
		entities['175'] = '&macr;';
		entities['176'] = '&deg;';        entities['177'] = '&plusmn;';
		entities['178'] = '&sup2;';
		entities['179'] = '&sup3;';
		entities['180'] = '&acute;';
		entities['181'] = '&micro;';        entities['182'] = '&para;';
		entities['183'] = '&middot;';
		entities['184'] = '&cedil;';
		entities['185'] = '&sup1;';
		entities['186'] = '&ordm;';        entities['187'] = '&raquo;';
		entities['188'] = '&frac14;';
		entities['189'] = '&frac12;';
		entities['190'] = '&frac34;';
		entities['191'] = '&iquest;';        entities['192'] = '&Agrave;';
		entities['193'] = '&Aacute;';
		entities['194'] = '&Acirc;';
		entities['195'] = '&Atilde;';
		entities['196'] = '&Auml;';        entities['197'] = '&Aring;';
		entities['198'] = '&AElig;';
		entities['199'] = '&Ccedil;';
		entities['200'] = '&Egrave;';
		entities['201'] = '&Eacute;';        entities['202'] = '&Ecirc;';
		entities['203'] = '&Euml;';
		entities['204'] = '&Igrave;';
		entities['205'] = '&Iacute;';
		entities['206'] = '&Icirc;';        entities['207'] = '&Iuml;';
		entities['208'] = '&ETH;';
		entities['209'] = '&Ntilde;';
		entities['210'] = '&Ograve;';
		entities['211'] = '&Oacute;';        entities['212'] = '&Ocirc;';
		entities['213'] = '&Otilde;';
		entities['214'] = '&Ouml;';
		entities['215'] = '&times;';
		entities['216'] = '&Oslash;';        entities['217'] = '&Ugrave;';
		entities['218'] = '&Uacute;';
		entities['219'] = '&Ucirc;';
		entities['220'] = '&Uuml;';
		entities['221'] = '&Yacute;';        entities['222'] = '&THORN;';
		entities['223'] = '&szlig;';
		entities['224'] = '&agrave;';
		entities['225'] = '&aacute;';
		entities['226'] = '&acirc;';        entities['227'] = '&atilde;';
		entities['228'] = '&auml;';
		entities['229'] = '&aring;';
		entities['230'] = '&aelig;';
		entities['231'] = '&ccedil;';        entities['232'] = '&egrave;';
		entities['233'] = '&eacute;';
		entities['234'] = '&ecirc;';
		entities['235'] = '&euml;';
		entities['236'] = '&igrave;';        entities['237'] = '&iacute;';
		entities['238'] = '&icirc;';
		entities['239'] = '&iuml;';
		entities['240'] = '&eth;';
		entities['241'] = '&ntilde;';        entities['242'] = '&ograve;';
		entities['243'] = '&oacute;';
		entities['244'] = '&ocirc;';
		entities['245'] = '&otilde;';
		entities['246'] = '&ouml;';        entities['247'] = '&divide;';
		entities['248'] = '&oslash;';
		entities['249'] = '&ugrave;';
		entities['250'] = '&uacute;';
		entities['251'] = '&ucirc;';        entities['252'] = '&uuml;';
		entities['253'] = '&yacute;';
		entities['254'] = '&thorn;';
		entities['255'] = '&yuml;';
	}
	if (useQuoteStyle !== 'ENT_NOQUOTES') {
		entities['34'] = '&quot;';
	}
	if (useQuoteStyle === 'ENT_QUOTES') {
		entities['39'] = '&#39;';
	}
	entities['60'] = '&lt;';
	entities['62'] = '&gt;';

	// ascii decimals to real symbols
	for (decimal in entities) {
		if (entities.hasOwnProperty(decimal))
			hash_map[String.fromCharCode(decimal)] = entities[decimal];
	}

	return hash_map;
}

function htmlentities(string, quote_style, charset, double_encode) {
	// Convert all applicable characters to HTML entities
	//
	// version: 1109.2015
	// discuss at: http://phpjs.org/functions/htmlentities    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +   improved by: nobbler
	// +    tweaked by: Jack
	// +   bugfixed by: Onno Marsman    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +   bugfixed by: Brett Zamir (http://brett-zamir.me)
	// +      input by: Ratheous
	// +   improved by: Rafał Kukawski (http://blog.kukawski.pl)
	// +   improved by: Dj (http://phpjs.org/functions/htmlentities:425#comment_134018)    // -    depends on: get_html_translation_table
	// *     example 1: htmlentities('Kevin & van Zonneveld');
	// *     returns 1: 'Kevin &amp; van Zonneveld'
	// *     example 2: htmlentities("foo'bar","ENT_QUOTES");
	// *     returns 2: 'foo&#039;bar'
	var hash_map = get_html_translation_table('HTML_ENTITIES', quote_style), symbol = '';

	string = string == null ? '' : string + '';

	if (!hash_map) {
		return false;
	}

	if (quote_style && quote_style === 'ENT_QUOTES') {
		hash_map["'"] = '&#039;';
	}

	if (!!double_encode || double_encode == null) {
		for (symbol in hash_map) {
			if (hash_map.hasOwnProperty(symbol))
				string = string.split(symbol).join(hash_map[symbol]);
		}
	} else {
		string = string.replace(/([\s\S]*?)(&(?:#\d+|#x[\da-f]+|[a-zA-Z][\da-z]*);|$)/g, function (ignore, text, entity) {
			for (symbol in hash_map) {
				if (hash_map.hasOwnProperty(symbol))
					text = text.split(symbol).join(hash_map[symbol]);
			}
			return text + entity;
		});
	}
	return string;
}

function escapeHTML(str) {
	return str.replace(/[&"<>]/g, (m) => ({"&": "&amp;", '"': "&quot", "<": "&lt;", ">": "&gt;"})[m]);
}

function CreateAnonymousElement(markup, xul) {
	const DOMParser 		= new Components.Constructor("@mozilla.org/xmlextras/domparser;1", "nsIDOMParser");
	const SystemPrincipal 	= Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
	let parser = (new DOMParser());		parser.init(SystemPrincipal);
	let AnonymousElement;

	if(xul || xul == undefined) {
		AnonymousElement = parser.parseFromString('<overlay xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">'+markup+'</overlay>', 'text/xml')
				.firstChild		/* overlay*/
				.firstChild;	/* markup */
	} else {
		AnonymousElement = parser.parseFromString(markup, 'text/html')
				.body			/* body*/
				.firstChild;	/* markup */
	}

	AnonymousElement.parentNode.removeChild(AnonymousElement);
	return AnonymousElement;
}

/* Returns the maximum of the documentElement[prop] or body[prop] if available or 0 if doc is invalid */
function MaxDocValue(doc, prop) {
	return doc
		&& Math.max(doc.documentElement && doc.documentElement[prop] || 0, doc.body && doc.body[prop] || 0)
		|| 0;
}

/* Keeps track of previously called strings and returns deterministic ids (per run) */
function usn(s) {
	if(!this.s) {
		this.num = 1;
		this.s = { };
	}
	if(!this.s[s]) {
		this.s[s] = { num: this.num++, s: s };
	}
	return this.s[s].num;
}

/** Limits Function Calls with a Frequency Cap */
function CapCallFrequency(func, Frequency) {
	var LastCalcTime = Date.now() - Frequency + 1,
		CalcTimer;

	return function() {
		function CallBufferedFunction() {
			clearTimeout(CalcTimer);	CalcTimer = 0;
			LastCalcTime = Date.now();
			Frequency = (func() << 0) || Frequency;
		}

		let Elapsed = Date.now() - LastCalcTime;

		if(Elapsed < Frequency) {
			if(!CalcTimer)
				CalcTimer = setTimeout(CallBufferedFunction, (Frequency - Elapsed)+1);
			return false;
		}
		CallBufferedFunction();
		return true;
	};
}

function PromiseLoadFile(url) {
	return new Promise((resolve, reject) => {
		let request = new (CC("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest"));
		request.onload = (e) => {
			resolve([request.responseText, request.channel.contentType]);
		};
		request.onabort = request.onerror = ( e ) => {
			reject(e);
		};
		request.open('GET', url);
		request.send();
	});
}

function PromiseLoadDocument(url, callback) {
	return PromiseLoadFile(url)
		.then( ([responseText, contentType]) => {
			let parser = new (CC("@mozilla.org/xmlextras/domparser;1", "nsIDOMParser"));
			parser.init(new (CC(["@mozilla.org/systemprincipal;1"], "nsIPrincipal")), Services.io.newURI(url, null, null));
			return parser.parseFromString(responseText, contentType);
		});
}

var BootstrapMgr = Class.create({
	initialize         : function () {
		this.OverlayedDocs = new Map();
	},
	OverlayDocumentOnto: function (URL, doc) {
		function appendChildren(from, to) {
			let res = [ ];
			while(from.children.length) {
				to.appendChild(from.children[0]);
				res.push(to.lastChild);
			}
			return res;
		}
		PromiseLoadDocument(URL).then( overlay => {
			try {
				let OverlayedNodes = this.OverlayedDocs.get(doc) || [ ];

				for(let el of overlay.documentElement.children) {
					let existingRoot = null;
					if(el.id && (existingRoot = doc.querySelector(el.tagName + '#' + el.id)))
						OverlayedNodes.push(...appendChildren(el, existingRoot));
					else
						OverlayedNodes.push(doc.documentElement.appendChild(el) && el);
				}
				this.OverlayedDocs.set(doc, OverlayedNodes);
			} catch(e) {
				console.error(e);
			}
		})
		.catch( (e) => console.error );
	},
	RemoveOverlayNodes: function RemoveveOverlayNodes(doc) {
		(this.OverlayedDocs.get(doc) || [ ])
			.every( (el) => {
				el.remove();
				return true;
			});
		this.OverlayedDocs.delete(doc);
	}
});
