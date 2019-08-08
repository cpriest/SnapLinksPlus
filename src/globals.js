'use strict';

/**
 * @typedef {{x: number, y: number}}    Point
 * @typedef {HTMLAnchorElement|Element|HTMLInputElement}    ClickableElement
 */

let docElem = document.documentElement;

// General Purpose Variables
let _, __;

const NONE  = 0,
	  CTRL  = 1,
	  ALT   = 2,
	  SHIFT = 4;

//  (MouseEvent.buttons bitfield)
const LMB = 1,	// Left Mouse Button
	  RMB = 2,	// Right Mouse Button
	  MMB = 4;	// Middle Mouse Button

// Actions
const BACKGROUND_TEST   = 'BackgroundTest';
const RELOAD_EXTENSION  = 'ReloadExtension';
const OPEN_URLS_IN_TABS = 'OpenUrlsInTabs';

const isChrome  = location.protocol === 'chrome-extenson:',
		isFirefox = location.protocol === 'moz-extension:';

const DefaultPrefs = {
	IndexBuckets: 10,
	ScrollRate:   8,

	Activation_MinX: 5,
	Activation_MinY: 5,

	SelectionLabel_CursorMargin: 2,

	HighlightStyles_ActOnElements:       'fill: rgba(0,255,0,.10); stroke: rgba(0,255,0,1); stroke-width: 1px;',
	HighlightStyles_IndexBoundaryMarker: 'fill: rgba(128,128,128,.5);',

	HighlightStyles_ObscuredPoint: 'fill: rgba(255,0,0,.80);',
	HighlightStyles_ObscuredRect:  'fill: rgba(127,127,127,.10); stroke: rgba(127,127,127,.60); stroke-width: 1px;',

	OpenTabsAtEndOfTabBar: false,
	CopyLinksToClipboard: false,
	SwitchFocusToNewTab:   false,		// Needed/referenced anywhere?
	ShowNumberOfLinks:     true,
	ActivateModifiers:     NONE,
	ActivateMouseButton:   RMB,

	DisableFontWeightFiltering: false,

	SetOwnershipTabID_FF: false,	// Whether or not to set tab.openerTabId in Firefox on tab creation

	NewTabDelayMS: 50,	// The delay in ms between new tabs being opened
	ClickDelayMS:  50,   // The delay in ms between clicks on elements

	DevMode:                false,
	Dev_Log_ActionMessages: false,
	Dev_Skip_AllActions:    false,

	Debug_Measure_IndexingSpeed:     false,
	Debug_Measure_SearchSpeed:       false,
	Debug_Log_OutOfBoundElements:    false,
	Debug_Show_IndexBoundaryMarkers: false,
	Debug_Show_ObscuredMarks:        false,

	UI_AdvancedOptions_Section: false,
	UI_DevOptions_Section:      false,
};

// Pub-Sub Events
///////////////////

// Publisher: EventHandler
const DragRectChanged         = 'DragRectChanged',
		DragCompleted           = 'DragCompleted';
const DocSizeChanged          = 'DocSizeChanged',
		ElementPositionsChanged = 'ElementPositionsChanged';

// Publisher: SelectionRect
const ContainerElementCreated = 'ContainerElementCreated';

// Publisher: ElementIndexer
const ElementsSelected = 'ElementsSelected';


/** @type StoragePrefs */
let Prefs;

let DOMReady = new Promise((resolve, reject) => {
	function LoadPrefs() {
		Prefs = new StoragePrefs(DefaultPrefs, {
			Storage: 'sync'
		});
		Prefs.Ready
			.then(() => {
				resolve();
			});
	}

	if(document.readyState !== 'loading')
		return LoadPrefs();

	return window.addEventListener('DOMContentLoaded', () => LoadPrefs(), { once: true, passive: true });
});

let $A = Array.from;

/**
 * @param {string} css
 * @returns {Node[]}
 */
function $(css) {
	return $A(document.documentElement.querySelectorAll(css));
}

/**
 * Returns a promise that resolves in [ms]
 * @param {Number}    ms    The milliseconds to wait
 * @return {Promise}
 */
function sleep(ms) {
	if(ms <= 0)
		return Promise.resolve(0);
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns true if we are tracking the given element
 *
 * @param {HTMLElement} el
 */
function Tracking(el) {
	//noinspection PointlessBooleanExpressionJS
	return false && el && el.SnapTracker;
}

console.json = (arg) => {
	return JSON.parse(JSON.stringify(arg));
};

Function.prototype.wrap = function wrap(wrapper) {
	let wrapped = this;
	return wrapper.bind(undefined, (...args) => wrapped(...args));
};

function ReturnArg0Wrapper(wrapped, ...args) {
	wrapped(...args);
	return args[0];
}

console.log   = console.log.wrap(ReturnArg0Wrapper);
console.info  = console.info.wrap(ReturnArg0Wrapper);
console.error = console.error.wrap(ReturnArg0Wrapper);
console.warn  = console.warn.wrap(ReturnArg0Wrapper);
