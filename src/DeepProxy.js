'use strict';

function appendPrototype(insert, into) {
	let current = into;
	while(current.__proto__ != Object.prototype)
		current = current.__proto__;
	current.__proto__ = insert;
	insert.__proto__  = Object.prototype;
	return Object.create(into).__proto__;
}

function gettype(val) {
	let t = typeof val;

	if(t === 'object' && Array.isArray(val))
		t = 'array';

	return t;
}

class DeepProxy {
	constructor(target, parentHandlers = {}, options = {}) {
		let handlers = appendPrototype(DeepProxy.prototype, parentHandlers);

		return new Proxy(target, handlers);
	}

	get(target, key) {
		let value = target[key];

		switch(key) {
			case Symbol.species:
				return DeepProxy;
		}

		if(typeof value == 'object' || Array.isArray(value))
			return new Proxy(value, this);

		return value;
	}

	set(target, key, value) {
		target[key] = value;

		return true;
	}
}

DeepProxy.$path = Symbol.for('DeepProxy$path');

class OpenProxy extends DeepProxy {
	constructor(target, parentHandlers = {}, options = {}) {
		let handlers = appendPrototype(OpenProxy.prototype, parentHandlers);

		return super(target, handlers, options);
	}

	get(target, key) {
		if(typeof target[key] == 'undefined')
			target[key] = {};

		return super.get(target, key);
	}

	set(target, key, value) {
		return super.set(target, key, value);
	}
}

/**
 * 	Perhaps OverlayProxy should not extend OpenProxy but instead compose
 * 	two (deep|overlay) proxies
 */
class OverlayProxy {
	constructor(base, over, parentHandlers = {}, options = {}) {
		let handlers = appendPrototype(OverlayProxy.prototype, parentHandlers);

		base = new DeepProxy(base);
		over = new OpenProxy(over);

		return new Proxy({ base, over }, handlers);
	}

	get({ base, over }, key) {
		if(typeof base === 'object')
			base = base[key];
		over = over[key];

		if(typeof base === 'object' && base[Symbol.species] == DeepProxy)
			return new Proxy({ base, over }, this);

		if(typeof base !== 'undefined' && typeof over === 'object' && over[Symbol.species] == DeepProxy)
			return base;

		if(typeof over == 'object' || Array.isArray(over)) {
			return new Proxy({ base, over }, this);
		}

		return over;
	}

	set({ base, over }, key, value, receiver) {
		let baseVal   = (base || {})[key],
			baseType  = gettype(baseVal),
			valueType = gettype(value);

		// Do not allow overlay value to be incompatible base type
		if(valueType !== baseType && baseType !== 'undefined')
			throw new Error(`Cannot set ${key} to ${value} (${typeof baseVal}), base layer values' type is ${typeof baseVal}.`);

		// Setting value to base value, delete the overlay value
		if(value == baseVal) {
			delete over[key];
			return true;
		}

		// Complex object, unwrap and call setter on inner value
		if(typeof value == 'object') {
			let inner = receiver[key];

			for(let [innerKey, innerVal] of Object.entries(value))
				inner[innerKey] = innerVal;

			return true;
		}

		over[key] = value;

		return true;
	}

	getPrototypeOf({ base, over }) {
		if(typeof base !== 'undefined')
			return Object.getPrototypeOf(base);
		return Object.getPrototypeOf(over);
	}

	setPrototypeOf({ base, over }, prototype) { throw new Error('Cannot setPrototypeOf, not allowed.'); }

	deleteProperty({ base, over }, key) {
		if(typeof base == 'object' && key in base)
			return false;

		delete over[key];
		return true;
	}

	ownKeys({ base, over }) {
		let keys = [...Object.keys(over)];

		if(typeof base == 'object')
			keys = [...Object.keys(base), ...keys];

		return Array.from(new Set(keys));
	}

	/** @needs_test */
	has(target, key) {
		// Note: defined as local variables for code coverage reasons
		let keys = this.ownKeys(target);
		return keys.indexOf(key) !== -1;
	}

	defineProperty({ base, over }, key, descriptor) {
		// Disallow if key exists in base
		if(typeof base == 'object' && key in base)
			throw new Error('Cannot define property, property already exists in base layer.');

		if(typeof over == 'object' && key in over)
			throw new Error('Cannot define property, property already exists in overlay layer.');

		// Allow new property on overlay if base is not present
		return Object.defineProperty(over, key, descriptor);
	}

	getOwnPropertyDescriptor({ base, over }, key) {
		// Note: defined as local variables for code coverage reasons
		let baseDesc = Object.getOwnPropertyDescriptor(base, key),
			overDesc = Object.getOwnPropertyDescriptor(over, key);
		return baseDesc || overDesc;
	}
}

if(typeof module != 'undefined')
	module.exports = { DeepProxy, OpenProxy, OverlayProxy };
