'use strict';

/* exported SnapLinks, ElemDocRects, SvgOverlay, LastModifierKeys */

/** @type {EventHandler}    Global handler for main routine */
let SnapLinks;

/** @type {RectMapper}      Global reference to shared RectMapper cache*/
let ElemDocRects;

/** @type {SvgOverlayMgr}    Global reference to SvgOverlayMgr */
let SvgOverlay;

/** @type {Number}            The bitmask of modifier keys for the last mouse move event */
let LastModifierKeys;

/**
 * The main Event Handler for Snap Links, registers/un-registers event handlers as appropriate
 *
 * @refactor This class is probably doing too much
 */
class EventHandler {
	/**
	 * @constructor
	 */
	constructor() {
		this.onMouseUp         = this.onMouseUp.bind(this);
		this.onMouseMove       = this.onMouseMove.bind(this);
		this.onStopContextMenu = this.onStopContextMenu.bind(this);
		this.onKeyDown         = this.onKeyDown.bind(this);
		this.onKeyUp           = this.onKeyUp.bind(this);
		this.onMouseDown       = this.onMouseDown.bind(this);

		docElem.addEventListener('scroll', (e) => {
			pub(ElementPositionsChanged, {});
		}, true);
		docElem.addEventListener('mousedown', this.onMouseDown, true);
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseDown(e) {
		e = AddModsToEvent(e);

		if(Prefs.DevMode) {
			if(e.mods == CTRL + ALT && e.buttons == RMB) {
				this.StopNextContextMenu();
				browser.runtime.sendMessage({ Action: RELOAD_EXTENSION });
			} else if(e.mods == SHIFT + ALT && e.buttons == RMB) {
				this.StopNextContextMenu();
				browser.runtime.sendMessage({ Action: BACKGROUND_TEST });
			}
		}
		if(e.mods == Prefs.ActivateModifiers && e.buttons == Prefs.ActivateMouseButton)
			this.BeginDrag(e);
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseMove(e) {
		this.LastMouseEvent = AddModsToEvent(e);
		LastModifierKeys    = e.mods;
	}

	/**
	 * @param {MouseEvent} e
	 */
	onMouseUp(e) {
		this.EndDrag(e);
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	onKeyDown(e) {
		e = AddModsToEvent(e);
		switch(e.key) {
			case 'Escape':
				this.EndDrag(e);
				e.stop();

		}
	}

	/**
	 * @param {KeyboardEvent} e
	 */
	onKeyUp(e) {
//		e = AddModsToEvent(e);

//		if(this.CurrentSelection.IsLargeEnoughToActivate())
//			e.stop();
	}

	/**
	 * @param {MouseEvent} e
	 */
	onStopContextMenu(e) {
		e = AddModsToEvent(e);
		window.removeEventListener('contextmenu', this.onStopContextMenu, true);
		e.stop();
	}

	/**
	 * Initializes the start of the lasso rectangle drag
	 *
	 * @param {MouseEvent} e
	 */
	BeginDrag(e) {
		this.FirstInit();
		let [clientWidth, clientHeight] = GetClientDims();
		this.MousePos = { clientX: e.clientX, clientY: e.clientY };
		this.CurrentSelection.SetOrigin(
			window.scrollY + Math.min(this.MousePos.clientY, clientHeight),
			window.scrollX + Math.min(this.MousePos.clientX, clientWidth)
		);
		// this.CurrentSelection.SetOrigin(e.pageY, e.pageX);

		this.LastMouseEvent = e;

		/**
		 * @note: If this is still needed (was once needed for scrolling when outside the document view), checkout element.setPointerCapture
		 *    As per https://developer.mozilla.org/en-US/docs/Web/API/Element/setCapture
		 *    Leaving this here for now for notation, this was interfering with middle-clicking a link
		 */
//		if(document.documentElement.setCapture)
//			document.documentElement.setCapture(true);

		document.addEventListener('mouseup', this.onMouseUp, true);
		document.addEventListener('mousemove', this.onMouseMove, true);
		document.addEventListener('keydown', this.onKeyDown, true);
		document.addEventListener('keyup', this.onKeyUp, true);

		pub(DragStarted, {});

		sub(ElementsSelected, (Elements) => {
			this.SelectedElements = Elements;
		});

		this.mmTimer = setInterval(this.onMouseMoveInterval.bind(this), 30);
	}

	/**
	 * Called regularly by an interval timer setup in BeginDrag()
	 */
	onMouseMoveInterval() {
		let e = this.LastMouseEvent;

		let [docWidth, docHeight] = GetDocumentDims();

    if(!this.docSize || this.docSize.x != docWidth || this.docSize.y != docHeight) {
		this.docSize = { x: docWidth, y: docHeight };
	}

		let [clientWidth, clientHeight] = GetClientDims();

		if(e) {
			this.IntervalScrollOffset = {
				x: e.clientX < 0
					? e.clientX
					: e.clientX > clientWidth
						? e.clientX - clientWidth
						: 0,
				y: e.clientY < 0
					? e.clientY
					: e.clientY > clientHeight
						? e.clientY - clientHeight
						: 0,
			};

			this.MousePos = { clientX: e.clientX, clientY: e.clientY };
			delete this.LastMouseEvent;
		}

		window.scrollBy(this.IntervalScrollOffset.x, this.IntervalScrollOffset.y);

		/* Set our bottom right to scroll + max(clientX/Y, clientWidth/Height) */
		this.CurrentSelection.SetBottomRight(
			window.scrollY + Math.min(this.MousePos.clientY, clientHeight),
			window.scrollX + Math.min(this.MousePos.clientX, clientWidth)
		);
	}

	/**
	 * @param {MouseEvent|KeyboardEvent} e
	 */
	EndDrag(e) {
		this.mmTimer = clearInterval(this.mmTimer);

		switch(e.type) {
			case 'mouseup':
				if(this.CurrentSelection.IsLargeEnoughToActivate()) {
					this.StopNextContextMenu();
					pub(DragCompleted, { SelectedElements: this.SelectedElements, e: e });

					/**
					 * Unfortunately ActionMgr has to be called directly within the event hook chain,
					 * using pub/sub results in actions being considered "outside of short running user-generated event handlers
					 * @note Perhaps a synchronous channel may work, something to try in the future
					 **/
					if(this.SelectedElements)
						this.ActionHandler.ActUpon(this.SelectedElements, e);
				} else {pub(DragCompleted, { SelectedElements: [], e: e });}
				break;
			case 'keydown':
				if(!(e.mods & SHIFT && e.key == 'Escape'))
					pub(DragCompleted, { SelectedElements: [], e: e });
				break;
		}

		delete this.SelectedElements;

		document.removeEventListener('mouseup', this.onMouseUp, true);
		document.removeEventListener('mousemove', this.onMouseMove, true);
		document.removeEventListener('keydown', this.onKeyDown, true);

//		if(document.releaseCapture)
//			document.releaseCapture();
	}

	/**
	 * Stops the next context menu from showing, will de-register its-self upon one cycle
	 */
	StopNextContextMenu() {
		window.addEventListener('contextmenu', this.onStopContextMenu, true);
	}

	FirstInit() {
		if(this.ActionHandler)
			return;

		this.ActionHandler = new ActionMgr();
		ElemDocRects       = new RectMapper();
		this.ElemIndex     = new ElementIndexer();
		SvgOverlay         = new SvgOverlayMgr();

		this.CurrentSelection = new SelectionRect();
	}
}

DOMReady.then(() => {
	SnapLinks = new EventHandler();
});
