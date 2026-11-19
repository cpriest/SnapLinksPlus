'use strict';

/* exported ActionMgr */

class ActionMgr {
	/**
	 * Copies the links to the clipboard, the background script writes them in Prefs.CopyFormat
	 *
	 * @param {string[]}  links         The URLs to copy
	 * @param {Element[]} [Elements]    The selected link elements, their text is sent along as each URL's title
	 */
	CopyToClipboard(links, Elements = []) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Copying Links: %o', links);

		browser.runtime.sendMessage({
			Action:  COPY_TO_CLIPBOARD,
			tUrls:   links,
			tTitles: this.LinkTitles(links, Elements),
		});
	}

	/**
	 * Bookmarks the links in a new folder
	 *
	 * @param {string[]}  links         The URLs to bookmark
	 * @param {Element[]} [Elements]    The selected link elements, their text names the bookmarks
	 */
	BookmarkLinks(links, Elements = []) {
		if(Prefs.DevMode && Prefs.Dev_Skip_AllActions)
			return console.log('Skipped Bookmarking Links: %o', links);

		browser.runtime.sendMessage({
			Action:  BOOKMARK_LINKS_IN_FOLDER,
			tUrls:   links,
			tTitles: this.LinkTitles(links, Elements),
		});
	}

	/**
	 * Returns the title of each URL, from the first of the elements that links to it
	 *
	 * @param {string[]}  links       The URLs
	 * @param {Element[]} Elements    The link elements
	 *
	 * @returns {string[]}    The titles in the same order as links, '' for a URL without one
	 */
	LinkTitles(links, Elements) {
		let titles = new Map();

		for(let elem of Elements) {
			if(!titles.has(elem.href))
				titles.set(elem.href, this.LinkTitle(elem));
		}
		return links.map(url => titles.get(url) || '');
	}

	/**
	 * Returns the text a link shows: its text, or else its title / aria-label, or else the alt text of an image in it
	 *
	 * @param {Element} elem    The link
	 *
	 * @returns {string}    The text with whitespace collapsed, '' if the link has none
	 */
	LinkTitle(elem) {
		let text = (elem.innerText ?? elem.textContent ?? '')
			.replace(/\s+/g, ' ')
			.trim();

		return text ||
			elem.getAttribute?.('title') ||
			elem.getAttribute?.('aria-label') ||
			elem.querySelector?.('img[alt]')?.alt.trim() ||
			'';
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

				/** TODO: This should be cleaned up, not easily grokkable what this is meaning */
				// CTRL copies, unless copying is the default action, then CTRL opens the links in tabs
				if ((e.ctrlKey && Prefs.DefaultAction != COPY_LINKS) || (!(e.ctrlKey) && Prefs.DefaultAction == COPY_LINKS))
				    this.CopyToClipboard(links, SelectedElements.Links);
				else if(!e.ctrlKey && Prefs.DefaultAction == BOOKMARK_LINKS)
					this.BookmarkLinks(links, SelectedElements.Links);
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
