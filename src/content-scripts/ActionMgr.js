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
					// removing duplicates
					let links = Array.from(new Set(SelectedElements.Links.map((elem) => elem.href)));

					if(e.ctrlKey) {
						this.CopyToClipboard(links.join('\n'));
					} else {
						// For now we are simply going to create new tabs for the selected elements
						browser.runtime.sendMessage({
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
