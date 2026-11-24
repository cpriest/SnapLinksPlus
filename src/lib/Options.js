/*
 *	This code is a modification of webextensions-lib-configs which contains this license:
 *		license: The MIT License, Copyright (c) 2016 YUKI "Piro" Hiroshi
 *		original:
 *			http://github.com/piroor/webextensions-lib-configs
 */

'use strict';

// Selects the styles that match the browser's own options page, before the page is drawn
document.documentElement.classList.add(isChrome ? 'Chrome' : 'Firefox');
if(navigator.userAgent.includes(' Edg/'))
	document.documentElement.classList.add('Edge');

class Options {
	get isChrome() { return window.location.protocol === 'chrome-extension:'; }

	get isFireFox() { return window.location.protocol === 'moz-extension:'; }

	constructor(Prefs) {
		this.UI_MISSING         = null;
		this.UI_TYPE_UNKNOWN    = 0;
		this.UI_TYPE_TEXT_FIELD = 1;
		this.UI_TYPE_CHECKBOX   = 2;
		this.UI_TYPE_SELECT     = 3;
		this.UI_TYPE_OPENER     = 4;

		this.throttleTimers = {};
		this.prefs          = Prefs;

		if(!this.prefs || !this.prefs.Ready)
			throw new Error('No configuration given to Options');

		this.Initialize();
	}

	Initialize() {
		this.ConfigureElements();

		this.prefs.Ready
			.then(() => {
				Object.keys(this.prefs.Defaults)
					.forEach((aKey) => {
						switch(this.detectUIType(aKey)) {
							case this.UI_TYPE_CHECKBOX:
								this.bindToCheckbox(aKey);
								break;

							case this.UI_TYPE_TEXT_FIELD:
								this.bindToTextField(aKey);
								break;

							case this.UI_TYPE_SELECT:
								this.bindToSelect(aKey);
								break;

							case this.UI_TYPE_OPENER:
								this.bindToOpener(aKey);
								break;

							case this.UI_MISSING:
								return;

							default:
								throw new Error('unknown type UI element for ' + aKey);
						}
					});
			})
			.then(() => {
				let devModeElem = $('#DevMode')[0],
					devFieldset = $('#DevMode_Options')[0];

				let UpdateCheckboxState = () => {
					devFieldset.disabled = !devModeElem.checked;
				};
				devModeElem.addEventListener('change', UpdateCheckboxState);
				UpdateCheckboxState();
			})
			.then(() => this.SetupBookmarkPermission())
			.then(() => this.SetupSitesPermission());
	}

	/**
	 * Without access to all websites (see ALL_SITES_PERMISSION) an Allow button is shown, which asks for it.  The note follows
	 * changes made elsewhere too, eg: in the Permissions tab next to this page in about:addons.
	 */
	SetupSitesPermission() {
		let note   = $('#SitesPermission')[0],
			button = $('#GrantSitesPermission')[0];

		if(!note || !button || !browser.permissions)
			return;

		let update = async () => {
			note.hidden = await browser.permissions.contains(ALL_SITES_PERMISSION);
		};

		button.addEventListener('click', () => {
			// Called synchronously in the click handler, so the browser can still see the user's action
			browser.permissions.request(ALL_SITES_PERMISSION)
				.then(update)
				.catch(error => console.error('Snap Links could not request access to websites: ', error));
		});
		browser.permissions.onAdded?.addListener(update);
		browser.permissions.onRemoved?.addListener(update);

		return update();
	}

	/**
	 * Bookmarking needs the optional bookmarks permission, which a browser grants only during a user action on one of the
	 * extension's pages.  Choosing bookmarking as the default action asks for it at once; refusing puts the previous action
	 * back.  If the browser rejects the request (eg: a select change does not count as user input), or the permission is
	 * missing later, an Allow button is shown instead.
	 */
	SetupBookmarkPermission() {
		let action = $('#DefaultAction')[0],
			note   = $('#BookmarkPermission')[0],
			button = $('#GrantBookmarkPermission')[0];

		if(!action || !note || !button || !browser.permissions)
			return;

		let previous = action.value,
			update   = async () => {
				note.hidden = action.value != BOOKMARK_LINKS || await browser.permissions.contains(BOOKMARKS_PERMISSION);
			},
			request  = () => browser.permissions.request(BOOKMARKS_PERMISSION),
			logError = error => console.error('Snap Links could not request the bookmarks permission: ', error);

		button.addEventListener('click', () => {
			request()
				.then(update)
				.catch(logError);
		});

		action.addEventListener('change', () => {
			if(action.value != BOOKMARK_LINKS) {
				previous = action.value;
				return update();
			}
			// Called synchronously in the change handler, so the browser can still see the user's action
			request()
				.then(granted => {
					if(!granted) {
						action.value = previous;
						action.dispatchEvent(new Event('change', { bubbles: true }));	// Saves the previous action again
					}
				}, logError)
				.then(update);
		});

		return update();
	}

	ConfigureElements() {
		for(let elem of $A($('*[browsers]'))) {
			let browsers = elem.getAttribute('browsers')
				.toLowerCase();

			if(this.isChrome && browsers.includes('chrome'))
				continue;
			if(this.isFireFox && browsers.includes('firefox'))
				continue;

			elem.classList.add('disabled');
			for(let subElem of elem.querySelectorAll('input,select,button'))
				subElem.setAttribute('disabled', true);

		}
	}

	detectUIType(aKey) {
		let node = document.getElementById(aKey);
		if(!node)
			return this.UI_MISSING;

		switch(node.tagName) {
			case 'TEXTAREA':
				return this.UI_TYPE_TEXT_FIELD;
			case 'SELECT':
				return this.UI_TYPE_SELECT;
			case 'DETAILS':
				return this.UI_TYPE_OPENER;
			case 'INPUT':
				break;
			default:
				return this.UI_TYPE_UNKNOWN;
		}

		switch(node.type) {
			case 'text':
			case 'password':
				return this.UI_TYPE_TEXT_FIELD;
			case 'checkbox':
				return this.UI_TYPE_CHECKBOX;

			default:
				return this.UI_TYPE_UNKNOWN;
		}
	}

	throttledUpdate(aKey, aValue) {
		if(this.throttleTimers[aKey])
			clearTimeout(this.throttleTimers[aKey]);
		this.throttleTimers[aKey] = setTimeout(() => {
			delete this.throttleTimers[aKey];
			this.prefs[aKey] = aValue;
		}, 250);
	}

	bindToCheckbox(aKey) {
		let node     = document.getElementById(aKey);
		node.checked = this.prefs[aKey];
		node.addEventListener('change', () => {
			this.throttledUpdate(aKey, node.checked);
		});
	}

	bindToTextField(aKey) {
		let node   = document.getElementById(aKey);
		node.value = this.prefs[aKey];
		node.addEventListener('input', () => {
			this.throttledUpdate(aKey, node.value);
		});
	}

	bindToSelect(aKey) {
		let node   = document.getElementById(aKey);
		node.value = this.prefs[aKey];
		node.addEventListener('change', () => {
			this.throttledUpdate(aKey, node.value);
		});
		node.addEventListener('keyup', () => {
			this.throttledUpdate(aKey, node.value);
		});
	}

	bindToOpener(aKey) {
		let node  = document.getElementById(aKey);
		node.open = this.prefs[aKey];
		node.addEventListener('toggle', () => {
			this.throttledUpdate(aKey, node.open);
		});
	}
}

DOMReady.then((e) => {
	new Options(Prefs);
});
