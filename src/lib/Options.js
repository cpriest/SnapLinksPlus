/*
 *	This code is a modification of webextensions-lib-configs which contains this license:
 *		license: The MIT License, Copyright (c) 2016 YUKI "Piro" Hiroshi
 *		original:
 *			http://github.com/piroor/webextensions-lib-configs
 */

'use strict';

class Options {
	get isChrome() { return window.location.protocol === 'chrome-extension:'; }

	get isFireFox() { return window.location.protocol === 'moz-extension:'; }

	constructor(aConfigs) {
		this.UI_MISSING         = null;
		this.UI_TYPE_UNKNOWN    = 0;
		this.UI_TYPE_TEXT_FIELD = 1;
		this.UI_TYPE_CHECKBOX   = 2;
		this.UI_TYPE_SELECT     = 3;
		this.UI_TYPE_OPENER     = 4;

		this.throttleTimers = {};
		this.configs        = aConfigs;

		if(!this.configs || !this.configs.loaded)
			throw new Error('No configuration given to Options');

		this.Initialize();
	}

	Initialize() {
		this.ConfigureElements();

		this.configs.loaded
			.then(() => {
				Object.keys(this.configs.default)
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
			.then(() => {
				$('LABEL > INPUT[type=checkbox]')
					.forEach((elem) => {
						elem.addEventListener('change', (e) => {
							console.log(e);
						});
					});
			});
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
			this.configs[aKey] = aValue;
		}, 250);
	}

	bindToCheckbox(aKey) {
		let node     = document.getElementById(aKey);
		node.checked = this.configs[aKey];
		node.addEventListener('change', () => {
			this.throttledUpdate(aKey, node.checked);
		});
	}

	bindToTextField(aKey) {
		let node   = document.getElementById(aKey);
		node.value = this.configs[aKey];
		node.addEventListener('input', () => {
			this.throttledUpdate(aKey, node.value);
		});
	}

	bindToSelect(aKey) {
		let node   = document.getElementById(aKey);
		node.value = this.configs[aKey];
		node.addEventListener('change', () => {
			this.throttledUpdate(aKey, node.value);
		});
		node.addEventListener('keyup', () => {
			this.throttledUpdate(aKey, node.value);
		});
	}

	bindToOpener(aKey) {
		let node  = document.getElementById(aKey);
		node.open = this.configs[aKey];
		node.addEventListener('toggle', () => {
			this.throttledUpdate(aKey, node.open);
		});
	}
}

DOMReady.then((e) => {
	new Options(Prefs);
});
