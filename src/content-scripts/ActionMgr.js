'use strict';

/* exported ActionMgr */

class ActionMgr {
	constructor() {
	}

	/**
	 * Copies the given text to the clipboard
	 *
	 * @param {string[]} links
	 */
	CopyToClipboard(links) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Copying Links: %o', links);
		
			let joinedLinks = links.join('\n');
		
        	navigator.clipboard.writeText(joinedLinks).then(function() {
			/* clipboard successfully set */
			}, function() {
				/* clipboard write failed */
			});
	}
	
	


	/**
	 * Opens the set of links in new tabs
	 *
	 * @param {string[]} links
	 */
	OpenUrlsInTabs(links) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Opening Links: %o', links);

		// For now we are simply going to create new tabs for the selected elements
		browser.runtime.sendMessage({
			Action: OPEN_URLS_IN_TABS,
			tUrls:  links,
		});
	}

	/**
	 * Selects the first radio button per group
	 *
	 * @param {HTMLInputElement[]} RadioButtons
	 */
	SelectRadioButton(RadioButtons) {
		let GroupedByName = RadioButtons.reduce((/** Map */ acc, elem) => {
			return acc.set(elem.name, (acc.get(elem.name) || []).concat([elem]));
		}, new Map());

		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Radio Buttons: %o', GroupedByName);

		for(let [, tElems] of GroupedByName)
			tElems[0].click();
	}

	/**
	 * Clicks the collection of elements
	 *
	 * @param {HTMLElement[]} Clickable
	 */
	async ClickElements(Clickable) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Clicking: %o', Clickable);

		for(let elem of Clickable) {
			elem.click();
			await sleep(Prefs.ClickDelayMS);
		}
	}

	/**
	 * Toggles the collection of checkboxes by inverse majority
	 *
	 * @param {HTMLInputElement[]} Checkboxes
	 */
	ToggleCheckboxes(Checkboxes) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Checkboxes: %o', Checkboxes);

		// Determine majority checked/unchecked, prefers checking if counts are e
		let CheckedCount   = Checkboxes.reduce((acc, elem) => acc + elem.checked, 0),
			UncheckedCount = Checkboxes.length - CheckedCount,
			CheckElements  = UncheckedCount >= CheckedCount;

		Checkboxes
			.filter(elem => elem.checked != CheckElements)
			.forEach(elem => elem.click());
	}

	/**
	 * Performs the default action for the SelectedElements
	 *
	 * @param {CategorizedCollection}  SelectedElements    The elements selected by the user
	 * @param {MouseEvent}             e                   The final event that completed activated the action
	 */
	ActUpon(SelectedElements, e) {
		if(Prefs.DevMode && Prefs.Dev_Log_ActionMessages)
			console.log('ActUpon(%s) - %o', SelectedElements.GreatestType, SelectedElements);

		switch(SelectedElements.GreatestType) {
			case CT_LINKS:
				// Remove duplicates by HREF
				let links = Array.from(
					new Set(
						SelectedElements
							.Links
							.map(elem => elem.href)
					)
				);

				if((e.ctrlKey && Prefs.DefaultAction == '1' ) || ( !(e.ctrlKey) &&  Prefs.DefaultAction == '2'))
					this.CopyToClipboard(links);
				else
					this.OpenUrlsInTabs(links);

				break;

			case CT_CLICKABLE:
				this.ClickElements(SelectedElements.Clickable)
					.then();	// Returns a promise, ignored.
				break;

			case CT_CHECKBOXES:
				this.ToggleCheckboxes(SelectedElements.Checkboxes);
				break;

			case CT_RADIOBUTTONS:
				this.SelectRadioButton(SelectedElements.RadioButtons);
				break;
		}
	}
}
