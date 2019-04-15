'use strict';

// In Firefox, this is the sandbox, node needs to require(), this works in Chrome as well.
const csp = this.csp || require('js-csp');

class PubSubHandler {
	constructor() {
		this.Channel   = csp.chan();
		this.Publisher = csp.operations.pub(this.Channel, msg => msg.topic);
	}

	/**
	 * Publish a message to listeners, the class name of the msg becomes the topic
	 *
	 * @param {string|int} topic
	 * @param {object|null} data
	 */
	pub(topic, data) {
//		console.log('pub: %s -> %o', topic, data);							// #DevCode
		csp.putAsync(this.Channel, { topic: topic, data: data });
	}

	/**
	 * Subscribe to messages of the given topic, messages of the given topic will call the handler
	 *
	 * @param {string|string[]} topics
	 * @param {function} handler
	 *
	 * @returns {object} which has a single function of unsub() which cancels the subscription
	 */
	sub(topics, handler) {
		let SubscriberChannel = csp.chan();

		if(!(topics instanceof Array))
			topics = [topics];

//		console.log('sub: topics=%o', topics);								// #DevCode

		for(let topic of topics)
			csp.operations.pub.sub(this.Publisher, topic, SubscriberChannel);

		let enabled = true;

		let Subscription = {
			unsub: () => {
				for(let topic of topics)
					csp.operations.pub.unsub(this.Publisher, topic, SubscriberChannel);
				SubscriberChannel.close();
			},
			get enabled() { return enabled; },

			set enabled(x) {
				enabled = x;
				return this;
			},

		};

		go(function* (val) {
			while((val = yield SubscriberChannel) != csp.CLOSED) {
				if(enabled) {
//					console.log('sub->go() val=%o', val);					// #DevCode
					handler(val.topic, val.data, Subscription);
				} else {
//					console.log('sub->go(DISABLED) val=%o', val);			// #DevCode
				}
			}
		});

		return Subscription;
	}
}

let PubSub = new PubSubHandler();
let pub    = PubSub.pub.bind(PubSub);
let sub    = PubSub.sub.bind(PubSub);

// Imports from csp
let { go } = csp;

// Imports from transducers
// let { compose, map } = require('transducers');

// Utility functions for use with js-csp and transducers.js

function listen(elem, type, ch) {
	elem.addEventListener(type, e => {
		csp.putAsync(ch, e);
	});
}

if(typeof module != 'undefined') {
	module.exports = { pub, sub, csp, go, listen };
}
