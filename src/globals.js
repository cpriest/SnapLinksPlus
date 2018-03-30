/*
 * Copyright (c) 2016-2018 Clint Priest
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

'use strict';

let docElem = document.documentElement;

const NONE  = 0,
	  CTRL  = 1,
	  ALT   = 2,
	  SHIFT = 4;

//  (MouseEvent.buttons bitfield)
const LMB = 1,	// Left Mouse Button
	  RMB = 2,	// Right Mouse Button
	  MMB = 4;	// Middle Mouse Button

// Actions
const BACKGROUND_TEST = 'BackgroundTest';
const RELOAD_EXTENSION = 'ReloadExtension';
const OPEN_URLS_IN_TABS = 'OpenUrlsInTabs';

let isChrome  = location.protocol === 'chrome-extenson:',
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

	SwitchFocusToNewTab: true,
	ShowNumberOfLinks:   true,
	ActivateModifiers:   NONE,
	ActivateMouseButton: RMB,

	DisableFontWeightFiltering: false,

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

// Configurations
let Prefs = new Configs(DefaultPrefs);
Prefs.loaded.then((aValues) => {
	Prefs.DevMode = false;
	Prefs.Dev_Log_ActionMessages = false;
	Prefs.Dev_Skip_AllActions = false;
	// if(data.Dev.Enabled)
	// 	Object.assign(data.HighlightStyles, data.Dev.HighlightStyles);
});

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

/**
 * @param {string} css
 * @returns {Node[]}
 */
function $(css) {
	return Array.from(document.documentElement.querySelectorAll(css));
}

/**
 * Returns true if we are tracking the given element
 *
 * @param {HTMLElement} el
 */
function Tracking(el) {
	return false && el && el.tagName == 'A' && el.href == 'https://eggcave.com/click/2194270';
}
