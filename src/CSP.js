'use strict';

/** @typedef {{cancel: function():void, channel: String}} SubscriptionController

 /** @type {Object.<String,Array>} */
let channels = {};

/**
 * @param {String} Chan  The channel to publish a message to
 * @param {*} msg        The message payload
 */
function pub(Chan, msg) {
	let chan = Chan.toLowerCase();

	for(let handler of (channels[chan] || []))
		handler(msg);
}

/**
 * @param {String} Chan              The channel name to subscribe to
 * @param {function(*):*} handler    The handler function to receive data being published
 *
 * @return SubscriptionController    An object which can be used to cancel the subscription
 */
function sub(Chan, handler) {
	let chan = Chan.toLowerCase();

	if(channels[chan] === undefined)
		channels[chan] = [];

	channels[chan].push(handler);

	return {
		channel: Chan,

		cancel: () => {
			let _;
			if((_ = channels[chan].indexOf(handler)) >= 0) {
				channels[chan].splice(_, 1);
				return true;
			}

			let e     = new Error(`Subscription handler not found in channel ${Chan}`);
			e.handler = handler;
			throw e;
		},
	};
}

if(typeof module != 'undefined') 
	module.exports = { pub, sub };

