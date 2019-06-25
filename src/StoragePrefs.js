'use strict';

/**
 * @readonly
 * @enum {string}
 */
let Storage = [
	'local',
	'sync',
];

/**
 * @typedef {{Storage: {Storage}}}                            StorageOptions
 * @typedef {function({string} key, newValue, oldValue)}    StoragePrefsCallback
 * @typedef {{cancel: function()}}                            Cancelable
 */

/**
 * @class StoragePrefs
 */
class StoragePrefs {
	/**
	 * Instantiates the storage prefs which loads settings from local or sync storage
	 *  and overlays them on top of the defaults.  The .onChanged() function can be
	 *    used to register a listener for changes to preferences.
	 *
	 * @param {object} Defaults
	 * @param {StorageOptions} [Options={Storage: 'sync'}]
	 *
	 * @return {StoragePrefs}
	 */
	constructor(Defaults, Options = { Storage: 'sync' }) {
		this.Defaults = Defaults;

		this.Observers = [];
		this.Values    = undefined;

		this.storage = Options.Storage == 'local'
						? browser.storage.local
						: browser.storage.sync;

		(this.Ready = this.storage.get())
			.then((res, rej) => {
				if(rej)
					return console.error('StoragePrefs: browser.storage.get() rejected with: ', rej);

				this.Values = res;
			});

		return this._ = new Proxy(this, {
			get: (tgt, key, obj) => {
//				console.log(`StoragePrefs.get(${key})`);
				if(key in this)
					return this[key];
				if(!(key in this.Defaults))
					throw `StoragePrefs.${key} cannot be retrieved, not present in Defaults.`;

				if(!this.Values) {
					console.warn(`StoragePrefs: Attempt to get '${key}' before initialized, use StoragePrefs.Ready promise, returning default value.`);
					return this.Defaults[key];
				}

				return this.Values[key] || this.Defaults[key];
			},
			set: (tgt, key, value, obj) => {
//				console.log(`StoragePrefs.set(${key}, %o)`, value);
				if(key in this || this[key])
					this[key] = value;
				else {
					if(!(key in this.Defaults))
						throw `StoragePrefs.${key} cannot be set to '${value}', not present Defaults.`;

					if(!this.Values) {
						console.error(`StoragePrefs: Attempt to set '${key}' to '${value}' before initialized, use StoragePrefs.Ready promise, set ignored.`);
						return true;
					}

					let oldValue = this.Values[key];

					this.Values[key] = value;

					let store  = {};
					store[key] = value;

					this.storage.set(store)
						.then((res, rej) => {
							if(rej) {
								this.Values[key] = oldValue;
								return console.error(`StoragePrefs: browser.storage.set( { ${key}: '${value}' } ) rejected with: %o\n` +
														`   oldValue restored to ${oldValue}`, rej);
							}

							this.NotifyUpdated(key, value, oldValue);
						});
				}

				return true;
			},
		});
	}

	/**
	 * Called to notify Observers of a change to a value
	 * @private
	 *
	 * @param {string} key
	 * @param {any} newValue
	 * @param {any} oldValue
	 */
	NotifyUpdated(key, newValue, oldValue) {
		for(_ of this.Observers)
			_(key, newValue, oldValue);
	}

	/**
	 * Register a new observer for value change events
	 *
	 * @param {StoragePrefsCallback} fn
	 *
	 * @return {Cancelable}
	 */
	onChanged(fn) {
		this.Observers.push(fn);

		return {
			cancel: () => {
				let idx = this.Observers.indexOf(fn);
				if(idx < 0)
					return;

				this.Observers.splice(idx, 1);
			}
		};
	}
}
