'use strict';

/* exported SvgOverlayMgr */

/**
 * This class is intended to manage a transparent element sized to overlay the entire document and
 *    used to highlight elements in various ways.
 *
 *    To start with, it will just be to replace the elem.style.outline that's presently used and doesn't
 *    work correctly with elements which are clipped.
 */
class SvgOverlayMgr {
	/**
	 * Creates the SvgOverlay Manager
	 */
	constructor() {
		this.HighlightElemMap    = new WeakMap();
		this.HighlightedElements = [];
		this.AvailableRects      = [];

		let Subscription = sub(ContainerElementCreated, (Container) => {
			this.Init(Container);

			Subscription.cancel();
		});

	}

	/**
	 * Initializes the SvgOverlay
	 *
	 * @param {HTMLElement} Container    The SnapLinks Container Element
	 */
	Init(Container) {
		this.style   = Prefs.HighlightStyles_ActOnElements;
		this.Overlay = CreateElement(`
			<svg class="SnapLinksHighlighter" xmlns="http://www.w3.org/2000/svg">
				<rect width="0" height="0"/> <!-- Used for easily cloning the properly namespaced rect -->
			</svg>
		`);
		Container.appendChild(this.Overlay);

		sub(DocSizeChanged, (data) => {
			this.Reposition();
		});

		sub(ElementsSelected, (Elements) => {
			this.Highlight(Elements);
		});

		sub(DragCompleted, (data) => {
			this.Hide();
		});

		sub(ElementPositionsChanged, (data) => {
			this.Reposition();
		});
	}

	/**
	 * @protected
	 * Gets or Creates an SVGRect element and returns it
	 *
	 * @returns {SVGRectElement|?Node}
	 */
	_AddRect(attr) {
		if(!this.Overlay)
			return null;

		let elem;
		if(!this.AvailableRects.length) {
			elem = this.Overlay.firstElementChild.cloneNode(false);
			this.Overlay.appendChild(elem);
		} else {
			elem = this.AvailableRects.pop();
		}

		for(let name of Object.keys(attr))
			elem.setAttribute(name, attr[name]);

		return elem;
	}

	/**
	 * @param {Node[]}    tSvgElems    An array of SVGRects that are no longer needed, they are hidden and added to available rects
	 *
	 * @returns {SvgOverlayMgr}
	 */
	ReleaseRects(tSvgElems) {
		for(let elem of tSvgElems) {
			elem.style.display = 'none';
			this.AvailableRects.push(elem);
		}

		return this;
	}

	/**
	 * Called to highlight document elements using the SvgOverlay layer
	 *
	 * @param {CategorizedCollection|Array} Elements    A collection of elements which represent the current set of elements to be highlighted
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Highlight(Elements) {
		let tElems       = Elements.All || [],
			tPrevElems   = this.HighlightedElements,
			tUnhighlight = tPrevElems.filter(
				(elem) => { return !tElems.includes(elem); },
			),
			tHighlight   = tElems.filter(
				(elem) => { return !tPrevElems.includes(elem); },
			),
			offset       = { x: window.scrollX, y: window.scrollY };

		/* Remove highlighting of elements no longer in tElems */
		for(let elem of tUnhighlight)
			this.ReleaseRects(this.HighlightElemMap.get(elem));

		/* Add highlights for elements new to tElems */
		for(let elem of tHighlight) {

			let tSvgRects = [];

			for(let r of ElemDocRects.get(elem, offset)) {
				tSvgRects.push(
					this._AddRect({
						x:      r.left,
						y:      r.top,
						width:  r.width,
						height: r.height,
						style:  this.style,
						class:  'ActOn',
					}),
				);
			}
			this.HighlightElemMap.set(elem, tSvgRects);
		}
		this.HighlightedElements = tElems;

		// this.Overlay.style.display =
		// 	this.HighlightedElements.length
		// 		? ''
		// 		: 'none';

		return this;
	}

	AddIndexBoundaryMark(y) {
		this._AddRect({
			x:      0,
			y:      y,
			width:  docElem.scrollWidth,
			height: 2,
			style:  Prefs.HighlightStyles_IndexBoundaryMarker,
			class:  'IndexBoundaryMarker',
		});
	}

	AddPoint(x, y, type, attr = {}) {
		this._AddRect(Object.assign({
			x:      x,
			y:      y,
			width:  1,
			height: 1,
			style:  Prefs[`HighlightStyles_${type}`],
			class:  type,
		}, attr));
	}

	AddRect(x, y, width, height, type, attr = {}) {
		this._AddRect(Object.assign({
			x:      x,
			y:      y,
			width:  width,
			height: height,
			style:  Prefs[`HighlightStyles_${type}`],
			class:  type,
		}, attr));
	}

	/**
	 * Called to reconstruct and reposition all element highlights (such as onresize)
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Reposition() {
		let tPrevElems = this.HighlightedElements;
		this.Highlight([]);
		return this.Highlight(tPrevElems);
	}

	/**
	 * Called manually to clean up when this object is no longer needed
	 *
	 * @returns {SvgOverlayMgr}
	 */
	Hide() { return this.Highlight([]); }

	/**
	 * Releases the rects that match the given selector
	 * @param {string} selector    Any valid css selector
	 */
	Release(selector) {
		this.Overlay &&
			this.ReleaseRects(Array.from(this.Overlay.querySelectorAll(selector)));
		return this;
	}
}
