'use strict';

/* exported Storage, StoragePrefs */

/**
 * @readonly
 * @enum {string}
 */
let Storage = [
	'local',
	'sync',
];

/**
 * @typedef {string|number|bigint|boolean|null|undefined|symbol}  primitive
 * @typedef {{Storage: {Storage}}}                                StorageOptions
 * @typedef function({string} key, newValue, oldValue)            StoragePrefsCallback
 * @typedef {{cancel: function()}}                                Cancelable
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

		this.Options   = Options;
		this.Observers = [];
		this.Values    = undefined;

		this.storage = Options.Storage == 'local'
						? browser.storage.local
						: browser.storage.sync;

//		console.log(Options.Storage);
		(this.Ready = this.storage.get())
			.then((res, rej) => {
				if(rej)
					return console.error('StoragePrefs: browser.storage.get() rejected with: ', rej);

				this.Values = res;
//				console.log('storage.get(), Values = ', this.Values);
				browser.storage.onChanged.addListener(this.onStorageChanged = this.onStorageChanged.bind(this));
			});

		return this._ = new Proxy(this, {
			get: (tgt, key, obj) => {
				//noinspection UnnecessaryLocalVariableJS
				let value = (() => {
					if(key in this)
						return this[key];

					if(!(key in this.Defaults))
						throw new Error(`StoragePrefs.${key} cannot be retrieved, not present in Defaults.`);

					if(!this.Values) {
						console.warn(`StoragePrefs: Attempt to get '${key}' before initialized, use StoragePrefs.Ready promise, returning default value.`);
						return this.Defaults[key];
					}

					if(this.Values[key] !== undefined)
						return this.Values[key];

					return this.Defaults[key];
				})();

//				console.log(`StoragePrefs.%cget%c(%c${key}%c) = `, 'color: #00FF00', '', 'color: cyan;', '', value);

				return value;
			},

			set: (tgt, key, value, receiver) => {
//				console.log(`StoragePrefs.%cset%c(%c${key}%c, %o)`, 'color: red', '', 'color: cyan', '', value);

				if(key in this || this[key]) {this[key] = value;} else {
					if(!(key in this.Defaults))
						throw new Error(`StoragePrefs.${key} cannot be set to '${value}', not present Defaults.`);

					if(!this.Values) {
						console.error(`StoragePrefs: Attempt to set '${key}' to '${value}' before initialized, use StoragePrefs.Ready promise, set ignored.`);
						return true;
					}

					if(this.Values[key] == value)
						return true;

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
//							console.log('storage.set(%s) = ', key, value);
						});
				}

				return true;
			},
		});
	}

	/**
	 * Event listener for storage changes
	 *
	 * @param {{string: StorageChange}}    changes   This contains one property for each key that changed. The name of the property is the name of the key that changed,
	 *                                     and its value is a storage.StorageChange object describing the change to that item.
	 * @param {string}            area     The name of the storage area ("sync", "local" or "managed") to which the changes were made.
	 */
	onStorageChanged(changes, area) {
		if(area != this.Options.Storage)
			return;

		for(let [key, ch] of Object.entries(changes)) {
			ch.newValue = ch.newValue || ch.newValue;
			ch.oldValue = ch.oldValue || this.Values[key];

//			console.log(`onStorageChanged(${area}.${key}) = %o`, ch);

			this.Values[key] = ch.newValue;
			this.NotifyUpdated(key, ch.newValue, ch.oldValue);
		}
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
			},
		};
	}
}
