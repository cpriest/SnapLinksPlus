/*
 *	This code is a modification of webextensions-lib-configs which contains this license:
 *		license: The MIT License, Copyright (c) 2016 YUKI "Piro" Hiroshi
 *		original:
 *			http://github.com/piroor/webextensions-lib-configs
 */

'use strict';

class Configs {
	constructor(aDefaults) {
		this.lastValues = {};
		this.observers  = [];

		this.default = aDefaults;
		this.loaded  = this.load();

		return this._ = new Proxy(this, {
			get: (tgt, key, obj) => {
//				this.log(`get(${key})`);
				if(key in this)
					return this[key];
				if(!(key in this.default))
					throw `Prefs.${key} cannot be retrieved, not present in this.default`;
				return this.lastValues[key];
			},
			set: (tgt, key, value, obj) => {
//				this.log(`set(${key}, %o)`, value);
				if(key in this) {this[key] = value;}
				else {
					if(!(key in this.default))
						throw `Prefs.${key} cannot be set to ${value}, not present in this.default`;
					this.lastValues[key] = value;
					this.notifyUpdated(key);
				}

				return true;
			},
		});
	}


	get shouldUseStorage() {
		return typeof chrome.storage !== 'undefined' && location.protocol.match(/.+-extension:$/);
	}

	reset() {
		this.applyValues(this.default);

		if(this.shouldUseStorage) {
			return this.broadcast({
				type: 'Configs:reseted',
			});
		}

		return new Promise((aResolve, aReject) => {
			chrome.runtime.sendMessage({
				type: 'Configs:reset',
			}, () => aResolve());
		});
	}

	addObserver(aObserver) {
		if(this.observers.indexOf(aObserver) < 0)
			this.observers.push(aObserver);
	}

	removeObserver(aObserver) {
		let index = this.observers.indexOf(aObserver);
		if(index > -1)
			this.observers.splice(index, 1);
	}

	log(aMessage, ...aArgs) {
//		aMessage = `${this.shouldUseStorage ? 'Server' : 'Client'} => Config => ${aMessage}`;
//		console.log(aMessage, ...aArgs);
	}

	load() {
		if('_promisedLoad' in this) {
			if(this._promisedLoad) {
//				this.log('load => waiting to be loaded');
				return this._promisedLoad;
			}
//			this.log('load => already loaded');
			return Promise.resolve(this.lastValues);
		}

		this.applyValues(this.default);
		chrome.runtime.onMessage.addListener(this.onMessage.bind(this));

		/** Server mode */
		if(this.shouldUseStorage) {
//			this.log('load: try load from storage on ' + location.href);
			chrome.storage.onChanged.addListener(this.onChanged.bind(this));

			return this._promisedLoad = new Promise((aResolve, aReject) => {
				try {
					chrome.storage.local.get(this.default, (aValues) => {
						aValues = aValues || this.default;
//						this.log('load: loaded for ' + location.origin, aValues);
						this.applyValues(aValues);
						this._promisedLoad = null;
						aResolve(aValues);
					});
				} catch(e) {
//					this.log('load: failed', e);
					aReject(e);
				}
			});
		}

		/** Client mode */
//		this.log('load: initialize promise on ' + location.href);
		return this._promisedLoad = new Promise((aResolve, aReject) => {
			chrome.runtime.sendMessage(
				{ type: 'Configs:load' },
				(aValues) => {
					aValues = aValues || this.default;
//					this.log('load: responded', aValues);
					this.applyValues(aValues);
					this._promisedLoad = null;
					aResolve(aValues);
				});
		});
	}

	applyValues(aValues) {
		Object.keys(aValues)
			.forEach((aKey) => {
				this.lastValues[aKey] = aValues[aKey];
			});
	}

	onMessage(aMessage, aSender, aRespond) {
		if(!('type' in aMessage))
			return;

//		this.log('onMessage: ' + aMessage.type, aMessage, aSender);

		switch(aMessage.type) {
			// server
			case 'Configs:load':
				this.load()
					.then(aRespond);
				return true;
			case 'Configs:update':
				this._[aMessage.key] = aMessage.value;
				aRespond();
				break;
			case 'Configs:reset':
				this.reset()
					.then(aRespond);
				return true;

			// client
			case 'Configs:updated':
				this.lastValues[aMessage.key] = aMessage.value;
				this.notifyToObservers(aMessage.key);
				aRespond();
				break;
			case 'Configs:reseted':
				this.applyValues(this.default);
				Object.keys(this.default)
					.forEach((aKey) => {
						this.notifyToObservers(aKey);
					});
				aRespond();
				break;
		}
	}

	onChanged(aChanges) {
		let changedKeys = Object.keys(aChanges);
		changedKeys.forEach((aKey) => {
			this.lastValues[aKey] = aChanges[aKey].newValue;
			this.notifyToObservers(aKey);
		});
	}

	async broadcast(msg) {
		let results = [];

//		this.log('Broadcast', msg);

		if(chrome.runtime)
			results.push(await browser.runtime.sendMessage(msg));

		if(chrome.tabs) {
			results.push(...
				await Promise.all(
					(await browser.tabs.query({}))
						.map(async (tab) =>
							await browser.tabs.sendMessage(tab.id, msg, null)
								.catch(r => r)
						)
				)
			);
		}
//		this.log('Broadcast Done', msg);

		return results;
	}

	notifyUpdated(aKey) {
		let value = this._[aKey];
		if(this.shouldUseStorage) {
//			this.log('broadcast updated config: ' + aKey + ' = ' + value);
			try {
				let updatedKey   = {};
				updatedKey[aKey] = value;
				chrome.storage.local.set(updatedKey, () => {
//					this.log('successfully saved', updatedKey);
				});
			} catch(e) {
//				this.log('save: failed', e);
			}
			return this.broadcast({
				type:  'Configs:updated',
				key:   aKey,
				value: value,
			});
		}
//		this.log('request to store config: ' + aKey + ' = ' + value);
		return new Promise((aResolve, aReject) => {
			chrome.runtime.sendMessage({
					type:  'Configs:update',
					key:   aKey,
					value: value,
				},
				() => { aResolve(); },
			);
		});
	}

	notifyToObservers(aKey) {
		this.observers.forEach((aObserver) => {
			if(typeof aObserver === 'function')
				aObserver(aKey);
			else if(aObserver && typeof aObserver.onChangeConfig === 'function')
				aObserver.onChangeConfig(aKey);
		});
	}
}
