'use strict';

async function GetSimpleLocationHash(length = 4) {
	return Array.from(
			new Uint8Array(
				await crypto.subtle.digest('SHA-256',
					(new TextEncoder())
						.encode(window.location.href.toString())
				)
			)
		)
		.map(b => b.toString(16)
			.padStart(2, '0'))
		.join('')
		.substr(0, length);
}

browser.commands.onCommand.addListener((command) => {
	switch(command) {
		case 'dev-do-1':
			return DevDo1();
		case 'dev-do-2':
			return DevDo2();
	}
});

function DevDo1() {
	console.log('dev-do-1');
}

function DevDo2() {
	console.log('dev-do-2');
}
