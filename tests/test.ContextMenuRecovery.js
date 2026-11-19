'use strict';

/* global jest, test, expect, require, EventTarget, Event */

const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../src/content-scripts/EventHandler.js'), 'utf8');
const backgroundSource = fs.readFileSync(require.resolve('../src/background-scripts/background.js'), 'utf8');

// MouseEvent.buttons bitmasks used by the ActivateMouseButton preference.
const NO_BUTTONS_PRESSED = 0;
const LEFT_MOUSE_BUTTON = 1;
const RIGHT_MOUSE_BUTTON = 2;

const NO_MODIFIERS = 0;
const CTRL_MODIFIER = 1;
const ALT_MODIFIER = 2;
const SHIFT_MODIFIER = 4;

function createEventHandlerTestHarness({
	preferences = {}, contextMenuDragRecoveryEnabled, backgroundMessageError,
	selectionMeetsActivationThreshold = false, runtime,
} = {}) {
	// Sharing one target exercises the handler lifecycle without simulating DOM propagation.
	const pageEvents = new EventTarget();
	const selectionRectangle = {
		SetOrigin:               jest.fn(),
		IsLargeEnoughToActivate: jest.fn().mockReturnValue(selectionMeetsActivationThreshold),
	};
	const actionHandler = { ActUpon: jest.fn() };
	const console = { warn: jest.fn() };
	const backgroundMessageListeners = [];
	runtime = runtime || {
		sendMessage: backgroundMessageError
			? jest.fn().mockRejectedValue(backgroundMessageError)
			: jest.fn().mockResolvedValue(contextMenuDragRecoveryEnabled),
		onMessage: { addListener: listener => backgroundMessageListeners.push(listener) },
	};
	const context = vm.createContext({
		docElem:        pageEvents,
		document:       pageEvents,
		window:         Object.assign(pageEvents, { scrollX: 0, scrollY: 0 }),
		DOMReady:       Promise.resolve(),
		browser:        { runtime },
		console,
		Prefs:          { ...preferences },
		SHIFT:          SHIFT_MODIFIER,
		AddModsToEvent: e => {
			e.mods = (e.ctrlKey ? CTRL_MODIFIER : NO_MODIFIERS) +
				(e.altKey ? ALT_MODIFIER : NO_MODIFIERS) +
				(e.shiftKey ? SHIFT_MODIFIER : NO_MODIFIERS);
			e.stop = () => { e.preventDefault(); e.stopPropagation(); };
			return e;
		},
		GetClientDims:    () => [1000, 800],
		pub:              jest.fn(),
		sub:              jest.fn(),
		DragStarted:      'DragStarted',
		DragCompleted:    'DragCompleted',
		ElementsSelected: 'ElementsSelected',
		setInterval:      jest.fn().mockReturnValue(1),
		clearInterval:    jest.fn(),
	});
	return {
		selectionRectangle, actionHandler, console, runtime,
		receiveBackgroundMessage(message) {
			for(const listener of backgroundMessageListeners)
				listener(message);
		},
		async startEventHandler() {
			vm.runInContext(source, context);
			await context.DOMReady;
			this.eventHandler = vm.runInContext('SnapLinks', context);
			await this.eventHandler.ContextMenuRecoveryReady;
			// Keep the real event lifecycle while replacing selection rendering and actions.
			this.eventHandler.FirstInit = () => {
				this.eventHandler.CurrentSelection = selectionRectangle;
				this.eventHandler.ActionHandler = actionHandler;
			};
		},
		dispatchPageEvent(type, properties = {}) {
			const event = new Event(type, { cancelable: true });
			Object.assign(event, { buttons: NO_BUTTONS_PRESSED, clientX: 100, clientY: 100 }, properties);
			pageEvents.dispatchEvent(event);
			return event;
		},
	};
}

test('a right-button drag after an open menu selects links and opens them on release', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                       { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled:    true,
		selectionMeetsActivationThreshold: true,
	});
	await harness.startEventHandler();
	const dragStart = { clientX: 200, clientY: 150 };

	harness.dispatchPageEvent('contextmenu');
	// Firefox consumes the menu-dismissal press, so no mousedown reaches the page.
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON, ...dragStart });
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledWith(dragStart.clientY, dragStart.clientX);
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON, clientX: 400, clientY: 300 });
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(1);
	const selectedLinks = [{ href: 'https://example.com/' }];
	harness.eventHandler.SelectedElements = selectedLinks;
	const mouseRelease = harness.dispatchPageEvent('mouseup');

	expect(harness.actionHandler.ActUpon).toHaveBeenCalledWith(selectedLinks, mouseRelease);
	expect(harness.dispatchPageEvent('contextmenu').defaultPrevented).toBe(true);
	expect(harness.eventHandler.Dragging).toBe(false);
});

test('movement without a preceding context menu does not start a selection', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: true,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
});

test.each([
	{ description: 'no mouse button held', buttons: NO_BUTTONS_PRESSED },
	{ description: 'the left button held', buttons: LEFT_MOUSE_BUTTON },
	{ description: 'an unconfigured Ctrl modifier', buttons: RIGHT_MOUSE_BUTTON, ctrlKey: true },
])('an open context menu does not start a selection with $description', async ({ buttons, ctrlKey = false }) => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: true,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousemove', { buttons, ctrlKey });

	expect(harness.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
});

test('a canceled context menu does not enable drag recovery', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: true,
	});
	await harness.startEventHandler();
	const canceledContextMenu = new Event('contextmenu', { cancelable: true });
	canceledContextMenu.preventDefault();

	harness.eventHandler.onContextMenu(canceledContextMenu);
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
});

test('a regular mouse press starts selection at the press position without restarting on movement', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: true,
	});
	await harness.startEventHandler();
	const dragStart = { clientX: 250, clientY: 175 };

	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousedown', { buttons: RIGHT_MOUSE_BUTTON, ...dragStart });
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON, clientX: 400, clientY: 300 });

	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(1);
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledWith(dragStart.clientY, dragStart.clientX);
	expect(harness.eventHandler.ContextMenuShown).toBe(false);
});

test('Escape cancels a recovered drag and movement cannot restart it', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                       { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled:    true,
		selectionMeetsActivationThreshold: true,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });
	harness.eventHandler.SelectedElements = [{ href: 'https://example.com/' }];
	harness.dispatchPageEvent('keydown', { key: 'Escape' });
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.eventHandler.Dragging).toBe(false);
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(1);
	expect(harness.actionHandler.ActUpon).not.toHaveBeenCalled();
});

test('movement recovery still works after an earlier drag below the activation threshold', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                       { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled:    true,
		selectionMeetsActivationThreshold: false,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('mousedown', { buttons: RIGHT_MOUSE_BUTTON });
	harness.dispatchPageEvent('mouseup');
	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.eventHandler.Dragging).toBe(true);
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(2);
});

test('with context menu drag recovery disabled, movement cannot start a selection after a menu', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: false,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
	expect(harness.eventHandler.ContextMenuShown).toBeUndefined();
});

test('with context menu drag recovery disabled, a normal press still starts and completes selection', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                       { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled:    false,
		selectionMeetsActivationThreshold: true,
	});
	await harness.startEventHandler();
	const dragStart = { clientX: 250, clientY: 175 };

	harness.dispatchPageEvent('mousedown', { buttons: RIGHT_MOUSE_BUTTON, ...dragStart });
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON, clientX: 400, clientY: 300 });
	const selectedLinks = [{ href: 'https://example.com/' }];
	harness.eventHandler.SelectedElements = selectedLinks;
	const mouseRelease = harness.dispatchPageEvent('mouseup');

	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(1);
	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledWith(dragStart.clientY, dragStart.clientX);
	expect(harness.actionHandler.ActUpon).toHaveBeenCalledWith(selectedLinks, mouseRelease);
	expect(harness.dispatchPageEvent('contextmenu').defaultPrevented).toBe(true);
});

test('a failed background message leaves normal drag handling available', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:            { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		backgroundMessageError: new Error('Background unavailable'),
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('contextmenu');
	harness.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });
	expect(harness.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
	harness.dispatchPageEvent('mousedown', { buttons: RIGHT_MOUSE_BUTTON });

	expect(harness.selectionRectangle.SetOrigin).toHaveBeenCalledTimes(1);
	expect(harness.console.warn).toHaveBeenCalled();
});


// Route messages through the real background code while each frame has its own event handler.
function createFrameMessageRouter() {
	const backgroundListeners = [];
	const frames = [];
	const context = vm.createContext({
		isFirefox: true,
		// The recovery responder must work even while preference initialization is pending.
		DOMReady:  new Promise(() => {}),
		console:   { warn: jest.fn() },
		browser:   {
			runtime: {
				getPlatformInfo: jest.fn().mockResolvedValue({ os: 'linux' }),
				onMessage:       { addListener: listener => backgroundListeners.push(listener) },
				onInstalled:     { addListener: jest.fn() },
			},
			tabs: {
				sendMessage: jest.fn(async (tabId, message) => {
					for(const frame of frames)
						if(frame.tabId == tabId)
							for(const listener of frame.listeners)
								listener(message);
				}),
			},
		},
	});
	vm.runInContext(backgroundSource, context);
	return {
		createFrameRuntime(tabId) {
			const frame = { tabId, listeners: [] };
			frames.push(frame);
			return {
				onMessage:   { addListener: listener => frame.listeners.push(listener) },
				sendMessage: jest.fn(message => {
					for(const listener of backgroundListeners) {
						const response = listener(message, { tab: { id: tabId } });
						if(response !== undefined)
							return Promise.resolve(response);
					}
					return Promise.resolve(undefined);
				}),
			};
		},
		waitForBroadcasts: () => vm.runInContext('contextMenuStateMessages', context),
	};
}

test.each([
	{ openedIn: 'parent', draggedIn: 'iframe' },
	{ openedIn: 'iframe', draggedIn: 'parent' },
	{ openedIn: 'iframe', draggedIn: 'sibling iframe' },
])('a context menu opened in $openedIn allows selection in $draggedIn', async ({ openedIn, draggedIn }) => {
	const router = createFrameMessageRouter();
	const frames = {};
	const tabId = 42;
	for(const name of [openedIn, draggedIn]) {
		frames[name] = createEventHandlerTestHarness({
			preferences:                       { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
			runtime:                           router.createFrameRuntime(tabId),
			selectionMeetsActivationThreshold: true,
		});
		await frames[name].startEventHandler();
	}
	const menuFrame = frames[openedIn];
	const dragFrame = frames[draggedIn];

	menuFrame.dispatchPageEvent('contextmenu');
	await router.waitForBroadcasts();
	dragFrame.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });
	const selectedLinks = [{ href: 'https://example.com/' }];
	dragFrame.eventHandler.SelectedElements = selectedLinks;
	const mouseRelease = dragFrame.dispatchPageEvent('mouseup');
	await router.waitForBroadcasts();

	expect(dragFrame.actionHandler.ActUpon).toHaveBeenCalledWith(selectedLinks, mouseRelease);
	expect(menuFrame.eventHandler.ContextMenuShown).toBe(false);
	expect(dragFrame.dispatchPageEvent('contextmenu').defaultPrevented).toBe(true);
	// A received state update does not echo back to the background.
	expect(menuFrame.runtime.sendMessage).toHaveBeenCalledTimes(2);
});

test('menu state is shared only with frames in the same tab', async () => {
	const router = createFrameMessageRouter();
	const menuFrame = createEventHandlerTestHarness({ runtime: router.createFrameRuntime(42) });
	const otherTab = createEventHandlerTestHarness({
		preferences: { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		runtime:     router.createFrameRuntime(43),
	});
	await menuFrame.startEventHandler();
	await otherTab.startEventHandler();

	menuFrame.dispatchPageEvent('contextmenu');
	await router.waitForBroadcasts();
	otherTab.dispatchPageEvent('mousemove', { buttons: RIGHT_MOUSE_BUTTON });

	expect(otherTab.selectionRectangle.SetOrigin).not.toHaveBeenCalled();
	expect(otherTab.eventHandler.ContextMenuShown).toBeUndefined();
});

test('a delayed self broadcast cannot restore menu state after a normal press', async () => {
	const harness = createEventHandlerTestHarness({
		preferences:                    { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuDragRecoveryEnabled: true,
	});
	await harness.startEventHandler();

	harness.dispatchPageEvent('contextmenu');
	const menuShownMessage = harness.runtime.sendMessage.mock.calls[1][0];
	harness.dispatchPageEvent('mousedown', { buttons: RIGHT_MOUSE_BUTTON });
	harness.receiveBackgroundMessage(menuShownMessage);

	expect(harness.eventHandler.ContextMenuShown).toBe(false);
});

test('a normal press in another frame clears shared menu state', async () => {
	const router = createFrameMessageRouter();
	const menuFrame = createEventHandlerTestHarness({ runtime: router.createFrameRuntime(42) });
	const pressedFrame = createEventHandlerTestHarness({
		preferences: { ActivateModifiers: NO_MODIFIERS, ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		runtime:     router.createFrameRuntime(42),
	});
	await menuFrame.startEventHandler();
	await pressedFrame.startEventHandler();

	menuFrame.dispatchPageEvent('contextmenu');
	await router.waitForBroadcasts();
	pressedFrame.dispatchPageEvent('mousedown', { buttons: LEFT_MOUSE_BUTTON });
	await router.waitForBroadcasts();

	expect(menuFrame.eventHandler.ContextMenuShown).toBe(false);
	expect(pressedFrame.eventHandler.ContextMenuShown).toBe(false);
});
