"use strict";

/**
 * Handy shortcut for creating an element or element tree
 *
 * @param {string} html        Raw HTML to be used for creating the nodes
 *
 * @returns {HTMLElement}
 */
function CreateElement(html) {
	let DocFrag = document.createDocumentFragment();
	let result;

	DocFrag.appendChild(document.createElement('div'));
	DocFrag.firstChild.innerHTML = html;
	result                       = DocFrag.firstElementChild.firstElementChild;
	result.remove();

	return result;
}

/**
 * Returns a string of the given properties, like propName: propValue
 *
 * @param {object}        obj        The object to inspect
 * @param {string[]}    props    The properties to include
 */
function dir(obj, props) {
	let out = [];
	if(typeof obj != 'object')
		return 'dir(): not an object';

	for(let prop of props)
		out.push(prop + ': ' + obj[prop]);
	return out.join(', ');
}

/**
 * Class which provides for timing and metrics / elapsed time with output
 *    controlled via delayed template literal
 */
class RateReporter {
	/**
	 *
	 * @param {string}    msg     Template literal which should be passed as a string, when reporting
	 *                            the following variables are available to the template:
	 *                            Count:            The count variable passed in to report()
	 *                                PerSecond:        The Count / Second rate
	 *                                Elapsed:        The time that has elapsed
	 */
	constructor(msg) {
		this.msg     = msg;
		this.started = Date.now();
	}


	/**
	 * Report the results of the timing
	 *
	 * @param {int}	Count	The number of operations performed
	 */
	report(Count) {
		let ElapsedMS = (Date.now() - this.started),
			ElapsedS  = ElapsedMS / 1000,
			Elapsed;

		// Function to resolve template literal
		let z = new Function('Count', 'PerSecond', 'Elapsed', 'return `' + this.msg + '`');

		// Show ms if less than 1 second, otherwise seconds rounded to two places
		Elapsed = ElapsedMS < 1000
			? ElapsedMS + 'ms'
			: (Math.round(ElapsedS * 100) / 100) + 's';

		console.log(z(Count, (Math.round(Count / ElapsedS * 100) / 100) + '/s', Elapsed));
	}
}


/**
 * Adds a mods bitfield to an event based on ctrlKey, altKey and shiftKey states
 *
 * @param {MouseEvent|KeyboardEvent} e
 * @returns {MouseEvent|KeyboardEvent}
 */
function AddModsToEvent(e) {
	e.mods = (e.ctrlKey) + (e.altKey << 1) + (e.shiftKey << 2);
	e.stop = () => {
		e.preventDefault();
		e.stopPropagation();
	};
	return e;
}

/**
 * Returns the client dimensions, adjusting for various situations
 *
 * @returns {[number,number]}
 */
function GetClientDims() {
	let clientHeight = docElem.clientHeight,
		clientWidth  = docElem.clientWidth;

	if(document.documentElement.clientHeight > window.innerHeight) {
		clientHeight = document.body.clientHeight;
		clientWidth  = document.body.clientWidth;
	}
	return [ clientWidth, clientHeight ];
}
