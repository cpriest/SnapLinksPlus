/*
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2009  Tommi Rautava
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
 *
 *  Adapted from: http://www.salsitasoft.com/2011/11/19/on-using-jasmine-in-xpcshell-tests/
 *  	Original code by: Tomas Brambora
 */

var EXPORTED_SYMBOLS = ["setTimeout", "clearTimeout", "setInterval", "clearInterval" /*, "window"*/ ];

var Cc = Components.classes,
	Cu = Components.utils,
	Ci = Components.interfaces;

var _timers = [ ];

function setTimer(fun, timeout, type) {
	var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	_timers.push(timer);
	var event = {
		notify: function (timer) {
			fun();
			if(type == Ci.nsITimer.TYPE_ONE_SHOT)
				clearTimeout(timer);
		}
	};
	timer.initWithCallback(event, timeout, type);
	return timer;
}

function setTimeout(fun, timeout) {
	return setTimer(fun, timeout, Ci.nsITimer.TYPE_ONE_SHOT);
}

function setInterval(fun, timeout) {
	return setTimer(fun, timeout, Ci.nsITimer.TYPE_REPEATING_SLACK);
}

function clearTimeout(timer) {
	if (!timer)
		return;
	timer.cancel();

	let i = _timers.indexOf(timer);
	if(i > -1)
		_timers.splice(i, 1);
}
var clearInterval = clearTimeout;

/* For the moment, not exporting window, just the window functions

var window = {
	get document() { throw "WindowFaker.js object, no document exists." },
	get location() { throw "WindowFaker.js object, no document exists." },
	setTimeout: setTimeout,
	setInterval: setInterval,
	clearTimeout: clearTimeout,
	clearInterval: clearInterval,
	toString: function() { return "WindowFaker.js window object"; }
};

*/
