"use strict";


/* exported CreateElement, dir, RateReporter, AddModsToEvent, GetClientDims */

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

		// Show ms if less than 1 second, otherwise seconds rounded to two places
		Elapsed = ElapsedMS < 1000
			? ElapsedMS + 'ms'
			: (Math.round(ElapsedS * 100) / 100) + 's';

		let values = { Count, PerSecond: (Math.round(Count / ElapsedS * 100) / 100) + '/s', Elapsed };

		// Fills in the ${...} placeholders by name.  Evaluating the template as code (the Function constructor) is blocked by
		// the content security policy, which applies to content scripts in Manifest V3
		console.log(this.msg.replace(/\$\{(Count|PerSecond|Elapsed)\}/g, (placeholder, name) => values[name]));
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
 * Returns the size of the viewport (the visible part of the page) without its scrollbars, in client coordinates.
 *	In standards mode the root element reports it, in quirks mode the body does.  The other element's size is the size of
 *	its content (eg: body.clientHeight of a long page is the page's height), which is not the viewport and must not be used.
 *
 * @returns {[number,number]}
 */
function GetClientDims() {
	let root = document.compatMode === 'BackCompat' && document.body
		? document.body
		: document.documentElement;

	// The viewport can't be larger than the window, fall back to the window when the element reports nothing sensible
	let dim = (client, inner) => client > 0 && client <= inner
		? client
		: inner;

	return [dim(root.clientWidth, window.innerWidth), dim(root.clientHeight, window.innerHeight)];
}

/**
 * Returns the document dimensions, adjusting for various situations
 *
 * @returns {[number,number]}
 */
function GetDocumentDims() {
	let docHeight = Math.max(
			document.documentElement.scrollHeight,
			document.body.scrollHeight, docElem.scrollHeight,
			document.body.scrollHeight, docElem.scrollHeight,
			document.body.offsetHeight, docElem.offsetHeight,
			document.body.clientHeight, docElem.clientHeight
		),
		docWidth  = Math.max(
			document.documentElement.scrollWidth,
			document.body.scrollWidth, docElem.scrollWidth,
			document.body.offsetWidth, docElem.offsetWidth,
			document.body.clientWidth, docElem.clientWidth
		);

	return [docWidth, docHeight];
}
