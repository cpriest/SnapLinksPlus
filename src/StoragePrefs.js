'use strict';

/* exported Storage, StoragePrefs */

/**
 * @readonly
 * @enum {string}
 */
let Storage = [
	'auto',
	'local',
	'sync',
];

/**
 * @typedef {string|number|bigint|boolean|null|undefined|symbol}  primitive
 * @typedef {{StorageAPI: {Storage}}}                             StorageOptions
 * @typedef {function(key: string, newValue: any, oldValue:any)}  StoragePrefsCallback
 * @typedef {{cancel: function}}                                  Cancelable
 */

const StorageAPI_Key = 'StorageAPI';

/**
 * @class StoragePrefs
 */
class StoragePrefs {
	/**
	 * Instantiates the storage prefs which loads settings from local or sync storage
	 *  and overlays them on top of the defaults.  The .onChanged() function can be
	 *    used to register a listener for changes to preferences.
	 *
	 * @constructor
	 *
	 * @param {object} Defaults
	 * @param {StorageOptions} [Options={StorageAPI: 'auto,sync,local'}]
	 *
	 * @return {StoragePrefs}
	 */
	constructor(Defaults, Options = { StorageAPI: 'auto' }) {
		this.id       = 'XX';	// GetSimpleLocationHash(2)
		this.Defaults = Defaults;

		this.Observers = [];
		this.Values    = undefined;

		this.Ready = this.SetupStorageAPI(Options.StorageAPI || 'auto');
		this.Ready.then((res, rej) => {
			browser.storage.onChanged.addListener(this.onStorageChanged = this.onStorageChanged.bind(this));
		});

		return this.GetProxy();
	}

	GetProxy() {
		return new Proxy(this, {
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

//				console.log(`StoragePrefs(${this.id}).%cget%c(%c${key}%c) = `, 'color: #00FF00', '', 'color: cyan;', '', value);

				return value;
			},

			set: (tgt, key, value, receiver) => {
//				console.log(`StoragePrefs(${this.id}).%cset%c(%c${key}%c, %o)`, 'color: red', '', 'color: cyan', '', value);

				if(key in this || this[key]) {this[key] = value;} else {
					if(!(key in this.Defaults))
						throw new Error(`StoragePrefs.${key} cannot be set to '${value}', not present Defaults.`);

					if(!this.Values) {
						console.error(`StoragePrefs: Attempt to set '${key}' to '${value}' before initialized, use StoragePrefs.Ready promise, set ignored.`);
						return true;
					}

					if(key == StorageAPI_Key)
						this.Ready = this.SetStorageAPI(value);

					this.Ready.then(() => {
						let store  = {};
						store[key] = value;

						this.storage.set(store);
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
		for(let [key, ch] of Object.entries(changes)) {
			ch.newValue = ch.newValue || ch.newValue;
			ch.oldValue = ch.oldValue || this.Values[key];

			if(ch.newValue === ch.oldValue)
				continue;

			// If the change is to local storage and it's the StorageAPI_Key, then call SetupStorageAPI()
			if(area == 'local' && key == StorageAPI_Key && ch.newValue != ch.oldValue)
				this.Ready = this.SetupStorageAPI(ch.newValue);

			// *!*!*!
			// Different instances of StoragePrefs are not getting the update
			// about switching of StorageAPI
			//
			//	onStorageChanged() is called for even the thread that changed
			//	the value

			// Needs to call SetupStorage on notify of change to StorageAPI
			if(key in this.Defaults && area == (this.Values.StorageAPI || this.Defaults.StorageAPI)) {
				this.Values[key] = ch.newValue;
//				console.log(`${this.id}: (${area}) Updating Values[${key}] from ${ch.oldValue} to ${ch.newValue}`);
				this.NotifyUpdated(key, ch.newValue, ch.oldValue);
			}
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

	async GetValidStorageApiFromLocal() {
		let apiName = (await browser.storage.local.get(StorageAPI_Key))[StorageAPI_Key] || 'sync';

		if(['local', 'sync'].indexOf(apiName) == -1)
			apiName = 'sync';

		return apiName;
	}

	/**
	 * Initializes this.storage based on the Options value, resolves auto if necessary
	 */
	async SetupStorageAPI(StorageAPI) {
		if(StorageAPI == 'auto')
			StorageAPI = await this.GetValidStorageApiFromLocal();

		this.storage = StorageAPI == 'local'
						? browser.storage.local
						: browser.storage.sync;

		this.Values            = await this.storage.get();
		this.Values.StorageAPI = StorageAPI;

//		console.log(`${this.id}: storage.${StorageAPI}.get(), Values = `, this.Values);

		return true;
	}

	/**
	 * Switches the active Storage API to the tgtAPI
	 *
	 * @param {string} tgtAPI	The target, local or sync to switch to
	 *
	 * @return {Promise<boolean>}
	 */
	async SetStorageAPI(tgtAPI) {
		let curAPI = 'sync';

		// Ensure tgtAPI is valid (local or sync)
		if(['local', 'sync'].indexOf(tgtAPI) == -1)
			tgtAPI = 'sync';

		try {
			curAPI = await this.GetValidStorageApiFromLocal();
		} catch(e) {
			console.warn(`Could not fetch value of ${StorageAPI_Key} from local storage, defaulting to sync, ${e}`);
		}

		try {
			if(curAPI != tgtAPI) {
				let current = await browser.storage[curAPI].get();
				await browser.storage[tgtAPI].set(current);
			}

			// Save what storage api to use, using local storage, and re-setup storage
			let store             = {};
			store[StorageAPI_Key] = tgtAPI;
			await browser.storage.local.set(store);
		} catch(e) {
			throw new Error(`Could not transition storage from ${curAPI} to ${tgtAPI}\n${e}`);
		}

		return true;
	}
}
