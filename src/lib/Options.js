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

function Options(aConfigs) {
	this.configs = aConfigs;

	this.onReady = this.onReady.bind(this);
	document.addEventListener('DOMContentLoaded', this.onReady);
}

Options.prototype = {
	configs: null,

	throttleTimers: {},

	UI_MISSING        : null,
	UI_TYPE_UNKNOWN   : 0,
	UI_TYPE_TEXT_FIELD: 1 << 0,
	UI_TYPE_CHECKBOX  : 1 << 1,

	detectUIType: function(aKey) {
		let node = document.getElementById(aKey);
		if(!node)
			return this.UI_MISSING;

		if(node.localName == 'textarea')
			return this.UI_TYPE_TEXT_FIELD;

		if(node.localName != 'input')
			return this.UI_TYPE_UNKNOWN;

		switch(node.type) {
			case 'text':
			case 'password':
				return this.UI_TYPE_TEXT_FIELD;

			case 'checkbox':
				return this.UI_TYPE_CHECKBOX;

			default:
				return this.UI_TYPE_UNKNOWN;
		}
	},

	throttledUpdate: function(aKey, aValue) {
		if(this.throttleTimers[aKey])
			clearTimeout(this.throttleTimers[aKey]);
		this.throttleTimers[aKey] = setTimeout((function() {
			delete this.throttleTimers[aKey];
			this.configs[aKey] = aValue;
		}).bind(this), 250);
	},

	bindToCheckbox: function(aKey) {
		let node     = document.getElementById(aKey);
		node.checked = this.configs[aKey];
		node.addEventListener('change', (function() {
			this.throttledUpdate(aKey, node.checked);
		}).bind(this));
	},

	bindToTextField: function(aKey) {
		let node   = document.getElementById(aKey);
		node.value = this.configs[aKey];
		node.addEventListener('input', (function() {
			this.throttledUpdate(aKey, node.value);
		}).bind(this));
	},

	onReady: function() {
		document.removeEventListener('DOMContentLoaded', this.onReady);

		if(!this.configs || !this.configs.$loaded)
			throw new Error('you must give configs!');

		this.configs.$loaded
			.then((function() {
				Object.keys(this.configs.$default)
					  .forEach(function(aKey) {
						  switch(this.detectUIType(aKey)) {
							  case this.UI_TYPE_CHECKBOX:
								  this.bindToCheckbox(aKey);
								  break;

							  case this.UI_TYPE_TEXT_FIELD:
								  this.bindToTextField(aKey);
								  break;

							  case this.UI_MISSING:
								  return;

							  default:
								  throw new Error('unknown type UI element for ' + aKey);
						  }
					  }, this);
			}).bind(this));
	}
};

new Options(Prefs);
