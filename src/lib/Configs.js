/*
 * Copyright (c) 2018 Clint Priest
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

function Configs(aDefaults) {
	this.$default    = aDefaults;
	this.$lastValues = {};
	this.$loaded     = this.$load();
}

Configs.prototype = {

	$observers: [],

	$reset: function() {
		this.$applyValues(this.$default);
		if(this.$shouldUseStorage) {
			return this.$broadcast({
				type: 'Configs:reseted'
			});
		}
		else {
			return new Promise((function(aResolve, aReject) {
				chrome.runtime.sendMessage(
					{
						type: 'Configs:reset'
					},
					function() {
						aResolve();
					}
				);
			}).bind(this));
		}
	},

	$addObserver: function(aObserver) {
		let index = this.$observers.indexOf(aObserver);
		if(index < 0)
			this.$observers.push(aObserver);
	},

	$removeObserver: function(aObserver) {
		let index = this.$observers.indexOf(aObserver);
		if(index > -1)
			this.$observers.splice(index, 1);
	},

	get $shouldUseStorage() {
		return typeof chrome.storage !== 'undefined';
	},

	$log: function(aMessage, ...aArgs) {
		// let type = this.$shouldUseStorage
		// 	? 'storage'
		// 	: 'bridge';
		// aMessage = 'Configs[' + type + '] ' + aMessage;
		// if(typeof log === 'function')
		// 	log(aMessage, ...aArgs);
		// else
		// 	console.log(aMessage, ...aArgs);
	},

	$load: function() {
		this.$log('load');
		if('_promisedLoad' in this) {
			if(this._promisedLoad) {
				this.$log(' => waiting to be loaded');
				return this._promisedLoad;
			}
			this.$log(' => already loaded');
			return Promise.resolve(this.$lastValues);
		}

		this.$applyValues(this.$default);
		chrome.runtime.onMessage.addListener(this.$onMessage.bind(this));

		if(this.$shouldUseStorage) { // background mode
			this.$log('load: try load from storage on  ' + location.href);
			chrome.storage.onChanged.addListener(this.$onChanged.bind(this));
			return this._promisedLoad = new Promise((function(aResolve, aReject) {
				try {
					chrome.storage.local.get(this.$default, (function(aValues) {
						aValues = aValues || this.$default;
						this.$log('load: loaded for ' + location.origin, aValues);
						this.$applyValues(aValues);
						this._promisedLoad = null;
						aResolve(aValues);
					}).bind(this));
				}
				catch(e) {
					this.$log('load: failed', e);
					aReject(e);
				}
			}).bind(this));
		}
		else { // content mode
			this.$log('load: initialize promise on  ' + location.href);
			return this._promisedLoad = new Promise((function(aResolve, aReject) {
				chrome.runtime.sendMessage(
					{ type: 'Configs:load' },
					(function(aValues) {
						aValues = aValues || this.$default;
						this.$log('load: responded', aValues);
						this.$applyValues(aValues);
						this._promisedLoad = null;
						aResolve(aValues);
					}).bind(this)
				);
			}).bind(this));
		}
	},

	$applyValues: function(aValues) {
		Object.keys(aValues)
			  .forEach(function(aKey) {
				  this.$lastValues[aKey] = aValues[aKey];
				  if(aKey in this)
					  return;
				  Object.defineProperty(this, aKey, {
					  get: (function() {
						  return this.$lastValues[aKey];
					  }).bind(this),
					  set: (function(aValue) {
						  this.$log('set: ' + aKey + ' = ' + aValue);
						  this.$lastValues[aKey] = aValue;
						  this.$notifyUpdated(aKey);
						  return aValue;
					  }).bind(this)
				  });
			  }, this);
	},

	$onMessage: function(aMessage, aSender, aRespond) {
		this.$log('onMessage: ' + aMessage.type, aMessage, aSender);
		switch(aMessage.type) {
			// background
			case 'Configs:load':
				this.$load()
					.then(aRespond);
				return true;
			case 'Configs:update':
				this[aMessage.key] = aMessage.value;
				aRespond();
				break;
			case 'Configs:reset':
				this.$reset()
					.then(aRespond);
				return true;

			// content
			case 'Configs:updated':
				this.$lastValues[aMessage.key] = aMessage.value;
				this.$notifyToObservers(aMessage.key);
				aRespond();
				break;
			case 'Configs:reseted':
				this.$applyValues(this.$default);
				Object.keys(this.$default)
					  .forEach(function(aKey) {
						  this.$notifyToObservers(aKey);
					  }, this);
				aRespond();
				break;
		}
	},

	$onChanged: function(aChanges) {
		let changedKeys = Object.keys(aChanges);
		changedKeys.forEach(function(aKey) {
			this.$lastValues[aKey] = aChanges[aKey].newValue;
			this.$notifyToObservers(aKey);
		}, this);
	},

	$broadcast: function(aMessage) {
		let promises = [];

		if(chrome.runtime) {
			promises.push(new Promise((function(aResolve, aReject) {
				chrome.runtime.sendMessage(aMessage, function(aResult) {
					aResolve([aResult]);
				});
			}).bind(this)));
		}

		if(chrome.tabs) {
			promises.push(new Promise((function(aResolve, aReject) {
				chrome.tabs.query({}, (function(aTabs) {
					let promises = aTabs.map(function(aTab) {
						return new Promise((function(aResolve, aReject) {
							chrome.tabs.sendMessage(
								aTab.id,
								aMessage,
								null,
								aResolve
							);
						}).bind(this));
					}, this);
					Promise.all(promises)
						   .then(aResolve);
				}).bind(this));
			}).bind(this)));
		}

		return Promise.all(promises)
					  .then(function(aResultSets) {
						  let flattenResults = [];
						  aResultSets.forEach(function(aResults) {
							  flattenResults = flattenResults.concat(aResults);
						  });
						  return flattenResults;
					  });
	},

	$notifyUpdated: function(aKey) {
		let value = this[aKey];
		if(this.$shouldUseStorage) {
			this.$log('broadcast updated config: ' + aKey + ' = ' + value);
			try {
				let updatedKey   = {};
				updatedKey[aKey] = value;
				chrome.storage.local.set(updatedKey, (function() {
					this.$log('successfully saved', updatedKey);
				}).bind(this));
			}
			catch(e) {
				this.$log('save: failed', e);
			}
			return this.$broadcast({
				type : 'Configs:updated',
				key  : aKey,
				value: value
			});
		}
		else {
			this.$log('request to store config: ' + aKey + ' = ' + value);
			return new Promise((function(aResolve, aReject) {
				chrome.runtime.sendMessage(
					{
						type : 'Configs:update',
						key  : aKey,
						value: value
					},
					function() {
						aResolve();
					}
				);
			}).bind(this));
		}
	},

	$notifyToObservers: function(aKey) {
		this.$observers.forEach(function(aObserver) {
			if(typeof aObserver === 'function')
				aObserver(aKey);
			else if(aObserver && typeof aObserver.onChangeConfig === 'function')
				aObserver.onChangeConfig(aKey);
		}, this);
	}
};
