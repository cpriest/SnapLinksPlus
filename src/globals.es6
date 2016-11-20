/*
 * Copyright (c) 2016 Clint Priest
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

"use strict";

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
const RELOAD_EXTENSION  = 'ReloadExtension';
const OPEN_URLS_IN_TABS = 'OpenUrlsInTabs';

const data = {
	IndexBuckets   : 10,
	scrollRate     : 8,
	selection      : {
		activate: {
			minX: 5,
			minY: 5,
		},
		label   : {
			paddingFromCursor: 2,
		}
	},
	HighlightStyles: {
		ActOnElements: 'fill: rgba(0,255,0,.10); stroke: rgba(0,255,0,1); stroke-width: 1px;',
	},

	Debug: {
		Measure: {
			IndexingSpeed:	false,
			SearchSpeed:	false,
		},
		Log: {
			OutOfBoundElements: false,		// Elements who's top/bottom are greater than the documents height are skipped during indexing
		}
	},
	Dev: {							// #DevCode
		Log : {						// #DevCode
			ActionMessages: true,	// #DevCode
		},							// #DevCode
		Skip: {						// #DevCode
			AllActions: true,		// #DevCode
		},							// #DevCode
	},								// #DevCode
};

// Configurations
let configs = new Configs({
	switchFocusToNewTab: true,
	showNumberOfLinks: true,
});

/** Pub-Sub Events */

// Publisher: EventHandler
const DragRectChanged = 'DragRectChanged',
	  DragCompleted   = 'DragCompleted';
const DocSizeChanged  = 'DocSizeChanged';

// Publisher: SelectionRect
const ContainerElementCreated = 'ContainerElementCreated';

// Publisher: ElementIndexer
const ElementsSelected = 'ElementsSelected';
