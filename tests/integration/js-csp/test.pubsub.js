'use strict';

let { pub, sub } = require('../../../src/CSP');

// Creates and Returns a new spy
let MI7 = ($data, $undef) => jest.fn(
	(data) => {
		expect(data)
			.toBe($data);
		expect($undef)
			.toBe(undefined);
	});


//describe('CSP/transducers pub/sub', () => {
test('Publish Single Message - Received', (done) => {
	let $topic = 'test-topic-1',
		$data  = { a: 1 },
		$spy   = MI7($data);

	sub($topic, $spy);
	pub($topic, $data);

	expect($spy.mock.calls.length)
		.toBe(1);
	done();
});

test('Publish to Multiple Subscribers', (done) => {
	let $topic = 'test-topic-2',
		$data  = { a: 2 },
		$spy1  = MI7($data),
		$spy2  = MI7($data);

	sub($topic, $spy1);
	sub($topic, $spy2);
	pub($topic, $data);

	expect($spy1.mock.calls.length)
		.toBe(1);
	expect($spy2.mock.calls.length)
		.toBe(1);
	done();
});

test('Unsubscribe Works', (done) => {
	let $topic = 'test-topic-3',
		$data  = { a: 3 },
		$spy   = MI7($data);

	let $sub = sub($topic, $spy);
	pub($topic, $data);

	$sub.cancel();
	pub($topic, $data);

	expect($spy.mock.calls.length)
		.toBe(1);
	done();
});

test('Multiple Pub/Sub Unsub Works', (done) => {
	let $topic = 'test-topic-4',
		$data  = { a: 4 },
		$spy1  = MI7($data),
		$spy2  = MI7($data);

	let $sub1 = sub($topic, $spy1),
		$sub2 = sub($topic, $spy2);

	pub($topic, $data);

	$sub1.cancel();
	pub($topic, $data);

	$sub2.cancel();
	pub($topic, $data);

	expect($spy1.mock.calls.length)
		.toBe(1);
	expect($spy2.mock.calls.length)
		.toBe(2);
	done();
});


//});
