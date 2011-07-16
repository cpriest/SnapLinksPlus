/*
 *  Utility.js
 *
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
 *
 *  This file is part of Snap Links Plus.
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

/* Log() logs info to the Firebug plugin if available, identical usage to console.log() from within a client page */
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
/** Logs a warning to the standard console */
Log.Warning = function(Message, Source, Line, Column) {
	var ConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
							.getService(Components.interfaces.nsIConsoleService);
	var ScriptMessage = Components.classes["@mozilla.org/scripterror;1"]
							.createInstance(Components.interfaces.nsIScriptError);
	ScriptMessage.init(Message, Source, null, Line, Column, 1, null);
	ConsoleService.logMessage(ScriptMessage);
};

/*
 * Prototype Imports -- Mozilla Organization may not like these...
 */

var Util = {
	Object: {
		/* Returns true if object is a function */
		isFunction: function(object) {
			return typeof object === 'function';
		},
		/* Extends the destination object with properties from the source object */
		extend: function(destination, source) {
			for (var property in source)
				destination[property] = source[property];
			return destination;
		}
	},
	Function: {
		/* Returns an array of the argument names to the given function */
		ArgumentNames: function(func) {
			var names = func.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
							.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
							.replace(/\s+/g, '').split(',');
			return names.length == 1 && !names[0] ? [] : names;
		},
		/** Returns the given func wrapped with wrapper */
		Wrap: function(func, wrapper) {
			/* Localized version of Function.update from prototype */
			function update(array, args) {
				var arrayLength = array.length, length = args.length;
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
}

/** Fully functioning prototype class inheritence, also allows for getters/setters including c# style getters/setters */
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
	}, this );
	return Rects.map( function(rect) {
		return { 	top		: rect.top + offset.y,
					left	: rect.left + offset.x,
					bottom	: rect.top + rect.height + offset.y,
					right	: rect.left + rect.width + offset.x };
	} );
}

/* Applies the given style to the given element returns a hash of what changed styles were originally */
function ApplyStyle(elem, style) {
	var OriginalStyle = { };
	Object.keys(style).forEach( function(name) {
		OriginalStyle[name] = elem.style[name];
		elem.style[name] = style[name];
	}, this );
	return OriginalStyle;
}

/** Creates getters/setters on this class for each parameter specified in the map */
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
	},
	SetPref: function(Property, Value) {
		if(Value == undefined)
			Value = this.map[Property].Default;

		switch(this.map[Property].Type) {
			case 'bool':	return this.pref.setBoolPref(this.map[Property].Path, Value);
			case 'int':		return this.pref.setIntPref(this.map[Property].Path, Value);
			case 'char':	return this.pref.setCharPref(this.map[Property].Path, Value);
		}
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
