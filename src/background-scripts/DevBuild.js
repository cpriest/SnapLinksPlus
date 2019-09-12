'use strict';

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
