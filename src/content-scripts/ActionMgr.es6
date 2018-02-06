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

"use strict";


let ActionHandler = new (
	class ActionMgr {
		constructor() {
		}

		/**
		 * Copies the given text to the clipboard
		 *
		 * @param {string} text
		 */
		CopyToClipboard(text) {
			const input          = document.createElement('textarea');
			input.style.position = 'fixed';
			input.style.opacity  = '0';
			input.value          = text;
			document.body.appendChild(input);
			input.select();
			document.execCommand('Copy');
			document.body.removeChild(input);
		}

		/** Opens the specified links in new tabs
		 *
		 * @param {Element[]} links
		 */
		OpenLinks(links) {
			// if(isFirefox) {
				browser.runtime.sendMessage({
					Action: OPEN_URLS_IN_TABS,
					BaseUrl: window.location.href,
					tUrls: links.map((elem) => elem.href),
					// tUrls: links,
				});
			// return;
			// }

			//////////////////////////////////////////////////////
			//////////////////////////////////////////////////////
			//! NOTE: This doesn't work in Firefox (popup blocker) !
			//////////////////////////////////////////////////////
			//////////////////////////////////////////////////////

			// for(let elem of links) {
			// 	let oldTarget = elem.target;
			// 	elem.target   = "_blank";
			// 	elem.click();
			// 	elem.target = oldTarget;
			// }
		}
		/**
		 * Performs the default action for the SelectedElements
		 *
		 * @param {CategorizedCollection}  SelectedElements    The elements selected by the user
		 * @param {MouseEvent}             e                   The final event that completed activated the action
		 */
		ActUpon(SelectedElements, e) {
			if(Prefs.DevMode) {
				if(Prefs.Dev_Log_ActionMessages)
					console.log('ActUpon(%s) - %o', SelectedElements.GreatestType, SelectedElements);
				if(Prefs.Dev_Skip_AllActions)
					return;
			}

			switch(SelectedElements.GreatestType) {
				case CT_LINKS:
					// removing duplicates by href
					let links = Object.values(
						Array.from(SelectedElements.Links)
						.reduce((acc, elem) => {
							acc[elem.href] = elem;
							return acc;
						}, {}));

					if(e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey)
						this.CopyToClipboard(links.map((elem) => elem.href).join('\n'));
					else
						this.OpenLinks(links);

					break;
				case CT_CLICKABLE:
					for(let Button of SelectedElements.Clickable)
						Button.click();
					break;
				case CT_CHECKBOXES:
					// Determine majority checked/unchecked, prefers checking if counts are e
					let CheckedCount   = SelectedElements.Checkboxes.reduce((acc, elem) => acc + elem.checked, 0),
						UncheckedCount = SelectedElements.Checkboxes.length - CheckedCount,
						CheckElements  = UncheckedCount >= CheckedCount;

					SelectedElements.Checkboxes
						.filter( (elem) => elem.checked != CheckElements)
						.forEach( (elem) => elem.click());

					break;
				case CT_RADIOBUTTONS:
					let GroupedByName = SelectedElements.RadioButtons.reduce((/** Map */ acc, elem) => {
						return acc.set(elem.name, (acc.get(elem.name) || []).concat([elem]));
					}, new Map());

					for(let [, tElems] of GroupedByName)
						tElems[0].click();
					break;
			}
		}
	}
);
