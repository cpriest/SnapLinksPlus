'use strict';

let { pub, sub, csp, go } = require('../../../src/CSP');

const yieldTime = 25;

// Creates and Returns a new spy
let MI7 = ($topic, $data, $undef) => jest.fn(
	(topic, data, subscription) => {
		expect(topic)
			.toBe($topic);
		expect(data)
			.toBe($data);
		expect(subscription.unsub)
			.toBeDefined();
		expect($undef)
			.toBe(undefined);
	});


//describe('CSP/transducers pub/sub', () => {
test('Publish Single Message - Received', (done) => {
	let $topic = 'test-topic-1',
		$data  = { a: 1 },
		$spy   = MI7($topic, $data);

	go(function* () {
		sub($topic, $spy);
		pub($topic, $data);

		yield csp.timeout(yieldTime);

		expect($spy.mock.calls.length)
			.toBe(1);
		done();
	});
});

test('Publish to Multiple Subscribers', (done) => {
	let $topic = 'test-topic-2',
		$data  = { a: 2 },
		$spy1  = MI7($topic, $data),
		$spy2  = MI7($topic, $data);

	go(function* () {
		sub($topic, $spy1);
		sub($topic, $spy2);
		pub($topic, $data);

		yield csp.timeout(yieldTime);

		expect($spy1.mock.calls.length)
			.toBe(1);
		expect($spy2.mock.calls.length)
			.toBe(1);
		done();
	});
});

test('Unsubscribe Works', (done) => {
	let $topic = 'test-topic-3',
		$data  = { a: 3 },
		$spy   = MI7($topic, $data);

	go(function* () {
		let $sub = sub($topic, $spy);
		pub($topic, $data);

		yield csp.timeout(yieldTime);

		$sub.unsub();
		pub($topic, $data);
		yield csp.timeout(yieldTime);

		expect($spy.mock.calls.length)
			.toBe(1);
		done();
	});
});

test('Multiple Pub/Sub Unsub Works', (done) => {
	let $topic = 'test-topic-4',
		$data  = { a: 4 },
		$spy1  = MI7($topic, $data),
		$spy2  = MI7($topic, $data);

	go(function* () {
		let $sub1 = sub($topic, $spy1),
			$sub2 = sub($topic, $spy2);

		pub($topic, $data);
		yield csp.timeout(yieldTime);

		$sub1.unsub();
		pub($topic, $data);
		yield csp.timeout(yieldTime);

		$sub2.unsub();
		pub($topic, $data);
		yield csp.timeout(yieldTime);

		expect($spy1.mock.calls.length)
			.toBe(1);
		expect($spy2.mock.calls.length)
			.toBe(2);
		done();
	});
});


//});
