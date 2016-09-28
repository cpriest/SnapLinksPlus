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


let ActionHandler = new (
	class ActionMgr {
		constructor() {
			sub(DragCompleted, (topic, msg) => {
				if(msg.SelectedElements) {
					if(data.Dev) {
						if(data.Dev.Log.ActionMessages == true)															// #DevCode
							console.log('ActUpon(%s) - %o', msg.SelectedElements.GreatestType, msg.SelectedElements);	// #DevCode
						if(data.Dev.Skip.AllActions == true)															// #DevCode
							return;																						// #DevCode
					}																									// #DevCode
					this.ActUpon(msg.SelectedElements, msg.e)
				}
			});
		}

		/**
		 * Copies the given text to the clipboard
		 *
		 * @param {string} text
		 */
		CopyToClipboard(text) {
			const input          = document.createElement('textarea');
			input.style.position = 'fixed';
			input.style.opacity  = 0;
			input.value          = text;
			document.body.appendChild(input);
			input.select();
			document.execCommand('Copy');
			document.body.removeChild(input);
		}

		/**
		 * Performs the default action for the SelectedElements
		 *
		 * @param {CategorizedCollection}  SelectedElements    The elements selected by the user
		 * @param {MouseEvent}             e                   The final event that completed activated the action
		 */
		ActUpon(SelectedElements, e) {
			switch(SelectedElements.GreatestType) {
				case CT_LINKS:
					// removing duplicates
					let links = Array.from(new Set(SelectedElements.Links.map((elem) => elem.href)));

					if(e.ctrlKey) {
						this.CopyToClipboard(links.join('\n'));
					} else {
						// For now we are simply going to create new tabs for the selected elements

						//noinspection JSUnresolvedVariable,JSUnresolvedFunction
						chrome.runtime.sendMessage(
							{
								Action: OPEN_URLS_IN_TABS,
								tUrls : links,
							});
					}
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

					for(let elem of SelectedElements.Checkboxes)
						elem.checked = CheckElements;
					break;
				case CT_RADIOBUTTONS:
					let GroupedByName = SelectedElements.RadioButtons.reduce((/** Map */ acc, elem) => {
						return acc.set(elem.name, (acc.get(elem.name) || []).concat([elem]));
					}, new Map());

					for(let [, tElems] of GroupedByName)
						tElems[0].checked = true;
					break;
			}
		}
	}
);
