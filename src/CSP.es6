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
"use strict";

const DOCSIZECHANGE = 'Doc:Size Changed';

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
//		console.log('pub: %s -> %o', topic, data);			// #DevCode
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

//		console.log('sub: topics=%o', topics);							// #DevCode

		for(let topic of topics)
			csp.operations.pub.sub(this.Publisher, topic, SubscriberChannel);

		let Subscription = {
			unsub: () => {
				for(let topic of topics)
					csp.operations.pub.unsub(this.Publisher, topic, SubscriberChannel);
//				console.log('unsub() called');							// #DevCode
				SubscriberChannel.close();
			}
		};

		go(function*(val) {
			while((val = yield SubscriberChannel) != csp.CLOSED){
//				console.log('sub->go() val=%o', val);					// #DevCode
				handler(val.topic, val.data, Subscription);
			}
//			console.log('exiting sub->go()');							// #DevCode
		});

		return Subscription;
	}
}

let PubSub = new PubSubHandler();
let pub    = PubSub.pub.bind(PubSub);
let sub    = PubSub.sub.bind(PubSub);

// console.log('Created PubSubHandler: %o', PubSub);					// #DevCode

// Imports from csp
let { go } = csp;

// Imports from transducers
let { compose, map } = transducers;

// Utility functions for use with js-csp and transducers.js

function listen(elem, type, ch) {
	elem.addEventListener(type, e => {
		csp.putAsync(ch, e);
	})
}
