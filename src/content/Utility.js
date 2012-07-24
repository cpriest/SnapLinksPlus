/*
 *  Utility.js
 *
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
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

var EXPORTED_SYMBOLS = ["Class",
                        "PrefsDialogMapper",
                        "PrefsMapper",
                        "Util",
                        "$A",
                        "ApplyStyle",
                        "GetElementRects",
                        "Log",
						"Rect",
						'htmlentities',
						'escapeHTML'];

/**
 * Log() logs info to the Firebug plugin if available,
 * identical usage to console.log() from within a client page.
 */
function Log() {
	if(typeof Firebug != 'undefined') {
		Firebug.Console.logFormatted(arguments);
	} else {
		/* If Firebug not in our current context, try seeing if there is a recent browser window context that has it, if so, use it. */
		var mrbw = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator)
					.getMostRecentWindow("navigator:browser");
		if(typeof mrbw.Firebug != 'undefined')
			mrbw.Firebug.Console.logFormatted(arguments);
	}
}

/** Logs a warning to the standard console. */
Log.Warning = function(Message, Source, Line, Column) {
	var ConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
							.getService(Components.interfaces.nsIConsoleService);
	var ScriptMessage = Components.classes["@mozilla.org/scripterror;1"]
							.createInstance(Components.interfaces.nsIScriptError);
	ScriptMessage.init(Message, Source, null, Line, Column, 1, null);
	ConsoleService.logMessage(ScriptMessage);
};

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
		}
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
 * Fully functioning prototype class inheritence, also allows for getters/setters including c# style getters/setters */
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
					if (ancestor && Util.Object.isFunction(value) &&	Util.Function.ArgumentNames(value)[0] == "$super") {
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
	}, this );
	return OriginalStyle;
}

/**
 * Creates getters/setters on this class
 * for each parameter specified in the map.
 */
var PrefsMapper = Class.create({
	/**
	 *	@param BasePath string 	- String representing the prefix for automatic preference names based on property name of map
	 *	@param map object		- Object map of { PropertyTitle: { Parameters } }
	 *			Parameters:		(Required) Type: 		bool || int || char
	 *							(Required) Default:		Default Value of Preference
	 *							(Optional) Name:		Full preference path, defaults to {BasePath}.{PropertyTitle}
	 */
	initialize: function(BasePath, map) {
		this.BasePath = BasePath;
		this.map = map || {};
		this.pref = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);

		Object.keys(this.map).forEach( function(Property) {
			this.map[Property].Type = this.map[Property].Type || 'char';
			this.map[Property].Path = (this.map[Property].Name && this.map[Property].Name[0] == '.' && this.BasePath + this.map[Property].Name) || (this.BasePath + '.' + Property);

			Object.defineProperty(this, Property, {
				get:	function() { return this.GetPref(Property); },
				set:	function(x) { this.SetPref(Property, x); }
			});

			/* Ensure the value or default value is stored */
			try { this[Property] = this[Property]; }
				catch(e) { Log.Warning('Unable to retrieve or set preference: ' + this.map[Property].Path + '\r\n' + e.toString()); }
		}, this);
	},
	
	GetPref: function(Property) {
		if(this.pref.prefHasUserValue(this.map[Property].Path) == false)
			return this.map[Property].Default;
		
		switch(this.pref.getPrefType(this.map[Property].Path)) {
			case this.pref.PREF_STRING:	return this.pref.getCharPref(this.map[Property].Path);
			case this.pref.PREF_INT:	return this.pref.getIntPref(this.map[Property].Path);
			case this.pref.PREF_BOOL:	return this.pref.getBoolPref(this.map[Property].Path);
		}
		
		return undefined;
	},
	
	SetPref: function(Property, Value) {
		if(Value == undefined)
			Value = this.map[Property].Default;

		switch(this.map[Property].Type) {
			case 'bool':	return this.pref.setBoolPref(this.map[Property].Path, Value);
			case 'int':		return this.pref.setIntPref(this.map[Property].Path, Value);
			case 'char':	return this.pref.setCharPref(this.map[Property].Path, Value);
		}
		
		return undefined;
	},
	
	TranslatePref: function(Property, Map) {
		var PreviousValue;

		switch(this.pref.getPrefType(this.map[Property].Path)) {
			case this.pref.PREF_STRING:	PreviousValue = this.pref.getCharPref(this.map[Property].Path);	break;
			case this.pref.PREF_INT:	PreviousValue = this.pref.getIntPref(this.map[Property].Path);	break;
			case this.pref.PREF_BOOL:	PreviousValue = this.pref.getBoolPref(this.map[Property].Path);	break;
		}
		this.pref.deleteBranch(this.map[Property].Path);
		this[Property] = Map[PreviousValue];
		Log.Warning("Translated Preference (" + this.map[Property].Path + ") from " + PreviousValue + " to " + this[Property]);
	}
} );

var Rect = Class.create({
	initialize:function(top, left, bottom, right) {
		this._top = top;
		this._left = left;
		this._bottom = bottom || top;
		this._right = right || left;
	},
	get top()       { return Math.min(this._top, this._bottom);	},
	set top(top)    { this._top = top; },

	get left()      { return Math.min(this._left, this._right); },
	set left(left)  { this._left = left; },

	get bottom()    { return Math.max(this._top, this._bottom); },
	set bottom(bottom) { return this._bottom = bottom; },

	get right()     { return Math.max(this._left, this._right); },
	set right(right) { return this._right = right; },

	get width()     { return this.right - this.left; },
	get height()    { return this.bottom - this.top; },

	get IsInverted() { return this._left > this._right || this._top > this._bottom; },

	Offset:function(x, y) {
		this._left += x;
		this._right += x;
		this._top += y;
		this._bottom += y;

		return this;
	},
	Shrink:function(x, y) {
		this._left += x;
		this._right -= x;
		this._top += y;
		this._bottom -= y;

		return this;
	},
	Expand:function(x, y) {
		this.Shrink(-x, -y);

		return this;
	},
	GetIntersectRect: function(r) {
		var i = new Rect(Math.max(this.top, r.top), Math.max(this.left, r.left),
							Math.min(this.bottom, r.bottom), Math.min(this.right, r.right));
		if(i.IsInverted)
			return false;
		return i;
	},
	IntersectsWith: function(r) {
		return this.GetIntersectRect(r) !== false;
	},
	toString: function() {
		return ['t:'+this.top, 'l:'+this.left, 'b:'+this.bottom, 'r:'+this.right].join(' ');
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
	if (useQuoteStyle === 'ENT_QUOTES') {        entities['39'] = '&#39;';
	}
	entities['60'] = '&lt;';
	entities['62'] = '&gt;';

	// ascii decimals to real symbols
	for (decimal in entities) {
		if (entities.hasOwnProperty(decimal)) {
			hash_map[String.fromCharCode(decimal)] = entities[decimal];        }
	}

	return hash_map;
}

function htmlentities (string, quote_style, charset, double_encode) {
	// Convert all applicable characters to HTML entities
	//
	// version: 1109.2015
	// discuss at: http://phpjs.org/functions/htmlentities    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +   improved by: nobbler
	// +    tweaked by: Jack
	// +   bugfixed by: Onno Marsman    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	// +    bugfixed by: Brett Zamir (http://brett-zamir.me)
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
		hash_map["'"] = '&#039;';    }

	if (!!double_encode || double_encode == null) {
		for (symbol in hash_map) {
			if (hash_map.hasOwnProperty(symbol)) {                string = string.split(symbol).join(hash_map[symbol]);
			}
		}
	} else {
		string = string.replace(/([\s\S]*?)(&(?:#\d+|#x[\da-f]+|[a-zA-Z][\da-z]*);|$)/g, function (ignore, text, entity) {            for (symbol in hash_map) {
				if (hash_map.hasOwnProperty(symbol)) {
					text = text.split(symbol).join(hash_map[symbol]);
				}
			}
			return text + entity;
		});
	}
	 return string;
}

function escapeHTML(str) str.replace(/[&"<>]/g, function (m) ({ "&": "&amp;", '"': "&quot", "<": "&lt;", ">": "&gt;" })[m]);
