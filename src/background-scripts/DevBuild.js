'use strict';

browser.commands.onCommand.addListener(function(command) {
	switch(command) {
		case 'dev-do-1':
			return dev_do1();
		case 'dev-do-2':
			return dev_do2();
	}
});

function dev_do1() {
	console.log('dev-do-1');
}

function dev_do2() {
	console.log('dev-do-2');
}
