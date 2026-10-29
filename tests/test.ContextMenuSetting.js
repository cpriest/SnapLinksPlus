'use strict';

/* global jest, test, expect, require */

const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../src/background-scripts/background.js'), 'utf8');
const storagePreferencesSource = fs.readFileSync(require.resolve('../src/StoragePrefs.js'), 'utf8');

// MouseEvent.buttons bitmasks used by the ActivateMouseButton preference.
const LEFT_MOUSE_BUTTON = 1;
const RIGHT_MOUSE_BUTTON = 2;
const MIDDLE_MOUSE_BUTTON = 4;

function createBackgroundTestHarness({
	firefox = true, preferences = {}, contextMenuShowEvent, os = 'linux',
	preferencesReady = Promise.resolve(), storedPreferences, activeStorageArea = 'sync',
} = {}) {
	contextMenuShowEvent = contextMenuShowEvent || {
		set:   jest.fn().mockResolvedValue(true),
		clear: jest.fn().mockResolvedValue(true),
	};
	let observer;
	const storageListeners = [];
	const messageListeners = [];
	const storage = {
		local:     { get: jest.fn(async () => ({ ...storedPreferences?.local })) },
		sync:      { get: jest.fn(async () => ({ ...storedPreferences?.sync })) },
		onChanged: { addListener: listener => storageListeners.push(listener) },
	};
	const context = vm.createContext({
		isFirefox:         firefox,
		RMB:               RIGHT_MOUSE_BUTTON,
		_:                 undefined,
		BACKGROUND_TEST:   'BackgroundTest',
		RELOAD_EXTENSION:  'ReloadExtension',
		OPEN_URLS_IN_TABS: 'OpenUrlsInTabs',
		COPY_TO_CLIPBOARD: 'CopyToClipboard',
		Prefs:             {
			...preferences,
			Ready:     preferencesReady,
			onChanged: callback => { observer = callback; },
		},
		PreferenceDefaults: { StorageAPI: activeStorageArea, ActivateMouseButton: RIGHT_MOUSE_BUTTON, DevMode: false, ...preferences },
		InitialStorageArea: activeStorageArea,
		DOMReady:           preferencesReady,
		browser:            {
			storage,
			browserSettings: firefox ? { contextMenuShowEvent } : undefined,
			tabs:            { sendMessage: jest.fn().mockResolvedValue(undefined) },
			runtime:         {
				getPlatformInfo: jest.fn().mockResolvedValue({ os }),
				onInstalled:     { addListener: jest.fn() },
				onMessage:       { addListener: listener => messageListeners.push(listener) },
			},
		},
		console: { warn: jest.fn(), error: jest.fn() },
	});
	const waitForContextMenuUpdates = () => vm.runInContext('contextMenuSettingsChain', context);
	return {
		context, contextMenuShowEvent, storage, waitForContextMenuUpdates,
		async startBackground() {
			if(storedPreferences) {
				vm.runInContext(storagePreferencesSource, context);
				context.Prefs = vm.runInContext('new StoragePrefs(PreferenceDefaults, { StorageAPI: InitialStorageArea })', context);
				await context.Prefs.Ready;
			}
			vm.runInContext(source, context);
			await context.DOMReady;
			await waitForContextMenuUpdates();
		},
		dispatchStorageChange(changes, area) {
			for(const listener of storageListeners)
				listener(changes, area);
		},
		sendContentMessage(message, sender = {}) {
			for(const listener of messageListeners) {
				const response = listener(message, sender);
				if(response !== undefined)
					return Promise.resolve(response);
			}
			return Promise.resolve(undefined);
		},
		changePreference(key, value) {
			context.Prefs[key] = value;
			observer(key);
		},
	};
}

test('startup configures context menus to open on release when right-button selection is enabled', async () => {
	const harness = createBackgroundTestHarness({
		firefox:     true,
		preferences: { ActivateMouseButton: RIGHT_MOUSE_BUTTON },
	});

	await harness.startBackground();

	expect(harness.contextMenuShowEvent.set).toHaveBeenCalledWith({ value: 'mouseup' });
	expect(harness.contextMenuShowEvent.clear).not.toHaveBeenCalled();
});

test.each([
	['left', LEFT_MOUSE_BUTTON],
	['middle', MIDDLE_MOUSE_BUTTON],
])('startup releases context menu control for %s-button selection', async (buttonName, activationMouseButton) => {
	const harness = createBackgroundTestHarness({
		preferences: { ActivateMouseButton: activationMouseButton },
	});

	await harness.startBackground();

	expect(harness.contextMenuShowEvent.clear).toHaveBeenCalledWith({});
	expect(harness.contextMenuShowEvent.set).not.toHaveBeenCalled();
});

test('changing the activation button releases and reapplies context menu control in order', async () => {
	const harness = createBackgroundTestHarness({
		preferences: { ActivateMouseButton: RIGHT_MOUSE_BUTTON },
	});
	await harness.startBackground();
	let finishClear;
	let markClearStarted;
	const clearStarted = new Promise(resolve => { markClearStarted = resolve; });
	harness.contextMenuShowEvent.clear.mockImplementationOnce(() => {
		markClearStarted();
		return new Promise(resolve => { finishClear = resolve; });
	});

	harness.changePreference('ActivateMouseButton', LEFT_MOUSE_BUTTON);
	harness.changePreference('ActivateMouseButton', RIGHT_MOUSE_BUTTON);
	await clearStarted;

	expect(harness.contextMenuShowEvent.set).toHaveBeenCalledTimes(1);
	finishClear(true);
	await harness.waitForContextMenuUpdates();
	expect(harness.contextMenuShowEvent.clear).toHaveBeenCalledTimes(1);
	expect(harness.contextMenuShowEvent.set).toHaveBeenCalledTimes(2);
});

test('Chrome does not access Firefox browser settings', async () => {
	const harness = createBackgroundTestHarness({
		firefox:     false,
		preferences: { ActivateMouseButton: RIGHT_MOUSE_BUTTON },
	});
	await harness.startBackground();

	harness.changePreference('ActivateMouseButton', LEFT_MOUSE_BUTTON);
	await harness.waitForContextMenuUpdates();

	expect(harness.contextMenuShowEvent.set).not.toHaveBeenCalled();
	expect(harness.contextMenuShowEvent.clear).not.toHaveBeenCalled();
});

test.each([
	{ from: 'sync', to: 'local', initialButton: RIGHT_MOUSE_BUTTON, nextButton: LEFT_MOUSE_BUTTON, expectedOperation: 'clear' },
	{ from: 'local', to: 'sync', initialButton: LEFT_MOUSE_BUTTON, nextButton: RIGHT_MOUSE_BUTTON, expectedOperation: 'set' },
])('switching storage from $from to $to reconciles context menu ownership after loading', async ({ from, to, initialButton, nextButton, expectedOperation }) => {
	const harness = createBackgroundTestHarness({
		activeStorageArea: from,
		storedPreferences: {
			[from]: { ActivateMouseButton: initialButton },
			[to]:   { ActivateMouseButton: nextButton },
		},
	});
	await harness.startBackground();
	harness.contextMenuShowEvent.set.mockClear();
	harness.contextMenuShowEvent.clear.mockClear();
	let finishLoading;
	harness.storage[to].get.mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }));

	harness.dispatchStorageChange({ StorageAPI: { oldValue: from, newValue: to } }, 'local');
	await harness.waitForContextMenuUpdates();
	expect(harness.contextMenuShowEvent.set).not.toHaveBeenCalled();
	expect(harness.contextMenuShowEvent.clear).not.toHaveBeenCalled();
	finishLoading({ ActivateMouseButton: nextButton });
	await harness.context.Prefs.Ready;
	await harness.waitForContextMenuUpdates();

	expect(harness.context.Prefs.ActivateMouseButton).toBe(nextButton);
	expect(harness.contextMenuShowEvent[expectedOperation]).toHaveBeenCalledTimes(1);
});

test('recovery configuration is available before preference initialization completes', async () => {
	let finishLoadingPreferences;
	const preferencesReady = new Promise(resolve => { finishLoadingPreferences = resolve; });
	const harness = createBackgroundTestHarness({ preferencesReady, os: 'linux', firefox: true });
	const backgroundStarted = harness.startBackground();

	await expect(harness.sendContentMessage({ Action: 'GetContextMenuDragRecovery' })).resolves.toBe(true);
	expect(harness.contextMenuShowEvent.set).not.toHaveBeenCalled();
	expect(harness.contextMenuShowEvent.clear).not.toHaveBeenCalled();
	finishLoadingPreferences();
	await backgroundStarted;
});

test('a rejected setting update is reported and later updates still work', async () => {
	const harness = createBackgroundTestHarness({
		preferences:          { ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuShowEvent: {
			set:   jest.fn().mockRejectedValue(new Error('Setting unavailable')),
			clear: jest.fn().mockResolvedValue(true),
		},
	});

	await harness.startBackground();

	expect(harness.context.console.error).toHaveBeenCalled();
	harness.changePreference('ActivateMouseButton', LEFT_MOUSE_BUTTON);
	await harness.waitForContextMenuUpdates();
	expect(harness.contextMenuShowEvent.clear).toHaveBeenCalledWith({});
});

test('an unsuccessful setting update is reported', async () => {
	const harness = createBackgroundTestHarness({
		preferences:          { ActivateMouseButton: RIGHT_MOUSE_BUTTON },
		contextMenuShowEvent: {
			set:   jest.fn().mockResolvedValue(false),
			clear: jest.fn().mockResolvedValue(true),
		},
	});

	await harness.startBackground();

	expect(harness.context.console.warn).toHaveBeenCalled();
});

test.each([
	{ browserName: 'Firefox', os: 'linux', firefox: true, expectedRecoveryEnabled: true },
	{ browserName: 'Firefox', os: 'win', firefox: true, expectedRecoveryEnabled: false },
	{ browserName: 'Firefox', os: 'mac', firefox: true, expectedRecoveryEnabled: false },
	{ browserName: 'Firefox', os: 'android', firefox: true, expectedRecoveryEnabled: false },
	{ browserName: 'Chrome', os: 'linux', firefox: false, expectedRecoveryEnabled: false },
])('context menu drag recovery in $browserName on $os is $expectedRecoveryEnabled', async ({ os, firefox, expectedRecoveryEnabled }) => {
	const harness = createBackgroundTestHarness({ os, firefox });
	await harness.startBackground();

	await expect(harness.sendContentMessage({ Action: 'GetContextMenuDragRecovery' })).resolves.toBe(expectedRecoveryEnabled);
});


test.each([
	{ os: 'linux', firefox: true, expectedBroadcasts: 1 },
	{ os: 'win', firefox: true, expectedBroadcasts: 0 },
	{ os: 'mac', firefox: true, expectedBroadcasts: 0 },
	{ os: 'linux', firefox: false, expectedBroadcasts: 0 },
])('menu state on $os with Firefox=$firefox produces $expectedBroadcasts broadcasts', async ({ os, firefox, expectedBroadcasts }) => {
	const harness = createBackgroundTestHarness({ os, firefox });
	await harness.startBackground();

	await harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: true, source: 'frame-a' }, { tab: { id: 42 } });

	expect(harness.context.browser.tabs.sendMessage).toHaveBeenCalledTimes(expectedBroadcasts);
	if(expectedBroadcasts)
		expect(harness.context.browser.tabs.sendMessage).toHaveBeenCalledWith(42, {
			Action: 'SetContextMenuShown', shown: true, source: 'frame-a',
		});
});

test('menu state from a sender without a tab is not broadcast', async () => {
	const harness = createBackgroundTestHarness();
	await harness.startBackground();

	await harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: true, source: 'options-page' });

	expect(harness.context.browser.tabs.sendMessage).not.toHaveBeenCalled();
});

test('a menu-dismissed broadcast waits for the earlier menu-open broadcast', async () => {
	const harness = createBackgroundTestHarness();
	await harness.startBackground();
	let markDeliveryStarted;
	let finishDelivery;
	const deliveryStarted = new Promise(resolve => { markDeliveryStarted = resolve; });
	harness.context.browser.tabs.sendMessage.mockImplementationOnce(() => {
		markDeliveryStarted();
		return new Promise(resolve => { finishDelivery = resolve; });
	});

	const menuOpened = harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: true, source: 'frame-a' }, { tab: { id: 42 } });
	const menuDismissed = harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: false, source: 'frame-b' }, { tab: { id: 42 } });
	await deliveryStarted;
	expect(harness.context.browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
	finishDelivery();
	await Promise.all([menuOpened, menuDismissed]);

	expect(harness.context.browser.tabs.sendMessage).toHaveBeenLastCalledWith(42, {
		Action: 'SetContextMenuShown', shown: false, source: 'frame-b',
	});
});

test('a failed frame broadcast does not prevent the next menu state from being shared', async () => {
	const harness = createBackgroundTestHarness();
	await harness.startBackground();
	harness.context.browser.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab closed'));

	await harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: true, source: 'frame-a' }, { tab: { id: 42 } });
	await harness.sendContentMessage({ Action: 'SetContextMenuShown', shown: false, source: 'frame-a' }, { tab: { id: 42 } });

	expect(harness.context.console.warn).toHaveBeenCalled();
	expect(harness.context.browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
	expect(harness.context.browser.tabs.sendMessage).toHaveBeenLastCalledWith(42, {
		Action: 'SetContextMenuShown', shown: false, source: 'frame-a',
	});
});
