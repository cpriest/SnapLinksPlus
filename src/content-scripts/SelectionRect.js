'use strict';

/* exported SelectionRect */

/**
 * @property {number} top       The normalized top coordinate of the Rect
 * @property {number} left      The normalized left coordinate of the Rect
 * @property {number} bottom    The normalized bottom coordinate of the Rect
 * @property {number} right     The normalized right coordinate of the Rect
 * @property {number} width     The width of the Rect
 * @property {number} height    The height of the Rect
 */
class Rect {
	/**
	 * Constructs the {Rect} object
	 *
	 * @param {number} top     The top coordinate
	 * @param {number} left    The left coordinate
	 * @param {number} bottom  The bottom coordinate
	 * @param {number} right   The right coordinate
	 */
	constructor(top = 0, left = 0, bottom = 0, right = 0) {
		[this.originTop, this.originLeft]              = [top, left];
		[this.top, this.left, this.bottom, this.right] = [top, left, bottom, right];
		this.CalculateProperties();
	}

	/**
	 * @param {number} top     The initial top coordinate (typically of the mousedown event)
	 * @param {number} left    The initial left coordinate (typically of the mousedown event)
	 */
	SetOrigin(top, left) {
		this.originTop  = top;
		this.originLeft = left;

		return this.CalculateProperties();
	}

	/**
	 * Sets the bottom/right coordinate and ensures top/left are lowest numbers in case of inversion
	 *
	 * @param {number} bottom    The bottom coordinate
	 * @param {number} right    The right coordinate
	 *
	 * @returns {Rect}
	 */
	SetBottomRight(bottom, right) {
		[this.top, this.left]     = [Math.min(this.originTop, bottom), Math.min(this.originLeft, right)];
		[this.bottom, this.right] = [Math.max(this.originTop, bottom), Math.max(this.originLeft, right)];
		return this.CalculateProperties();
	}

	/**
	 * Calculates additional properties after top/left/bottom/right changes
	 *
	 * @returns {Rect}
	 */
	CalculateProperties() {
		this.width  = this.right - this.left;
		this.height = this.bottom - this.top;
		return this;
	}

	/**
	 * Expands the rect by x, y.  eg: .Expand(1, 0) -> left--; right++;
	 *    Negative values are permitted to
	 *
	 * @param {number} x    The amount by which to expand the {Rect}
	 * @param {number} y    The amount by which to expand the {Rect}
	 *
	 * @returns {Rect}
	 */
	Expand(x, y) {
		[this.top, this.bottom] = [this.top - y, this.bottom + y];
		[this.left, this.right] = [this.left - x, this.right + x];
		return this.CalculateProperties();
	}

	/**
	 * Checks for intersection with another {Rect}
	 *
	 * @param {Rect} r    The {Rect} to check for intersection
	 *
	 * @returns {boolean}
	 */
	Intersects(r) {
		/* Some/most of this code is duplicated from other parts of this class for performance reasons */

		// If the greatest top is higher than the lowest bottom, they don't intersect
		let GreatestTop  = Math.max(this.top, r.top),
			LowestBottom = Math.min(this.bottom, r.bottom);
		if(GreatestTop > LowestBottom)
			return false;

		// If the greatest left is higher than the lowest right, they don't intersect
		let GreatestLeft = Math.max(this.left, r.left),
			LowestRight  = Math.min(this.right, r.right);
		return GreatestLeft <= LowestRight;
	}

	/**
	 * Clips the rect on each side to the tighter of the two {Rects} (this vs r)
	 *
	 * @param {Rect} r
	 *
	 * @returns {Rect}
	 */
	ClipTo(r) {
		[this.top, this.left]     = [Math.max(this.top, r.top), Math.max(this.left, r.left)];
		[this.bottom, this.right] = [Math.min(this.bottom, r.bottom), Math.min(this.right, r.right)];

		return this.CalculateProperties();
	}

	/**
	 * Returns a textual representation of the object for easy of debugging
	 *
	 * @returns {string}
	 */
	toString() { return `{ top: ${this.top}, left: ${this.left}, bottom: ${this.bottom}, right: ${this.right}, width: ${this.width}, height: ${this.height} }`; }
}

/**
 * DocRect extends Rect to easily create a rect the size of the document
 */
class DocRect extends Rect {
	constructor(doc) {
		let [docWidth, docHeight] = GetDocumentDims();
		super(0, 0, docHeight, docWidth);
	}
}

/**
 * Wrapper for the selection rectangle element
 */
class SelectionRect {
	/**
	 * @constructor
	 */
	constructor() {
		this.dims = new Rect();

		//noinspection CssUnusedSymbol
		document.head.appendChild(
			this.StyleNode = CreateElement(`
				<style>
					.SnapLinksContainer :not([xyz]) {  }
					.SnapLinksContainer .SnapLinksHighlighter {
						all: initial; overflow: visible;
						position: absolute; top: 0px; left: 0px; width: 10px; height: 10px;
					}
					.SnapLinksContainer {
						pointer-events: none; z-index: 999999;
						position: absolute; top: 0px; left: 0px; margin: 0px; padding: 0px; height: 0px; width: 0px; }
					.SnapLinksContainer > .SL_SelectionRect { 
						outline: 2px dashed rgba(0,200,0,1); position: absolute; overflow: visible; z-index: 1;	
					}
					.SL_SelectionRect > .SL_SelectionLabel { 
						position: absolute; background: #FFFFD9; border: 1px solid black; border-radius: 2px; padding: 2px;	
						font: normal 12px Verdana; white-space: nowrap; color: #000000;	
					}
				</style>
			`)
		);

		this.elContainer = CreateElement(
			'<div class="SnapLinksContainer">' +
			'	<div class="SL_SelectionRect">' +
			'		<div class="SL_SelectionLabel"></div>' +
			'	</div>' +
			'</div>'
		);

		this.elRect = this.elContainer.firstElementChild;

		document.body.appendChild(this.elContainer);

		/* This adjusts the main containing element to position it at 0,0 no matter how it may be
		 offset by parent CSS.  This works better than body.marginLeft because that only
		 applies in the position is set
		 */
		let rContainer                    = this.elContainer.getClientRects()[0];
		this.elContainer.style.marginLeft = `-${rContainer.left + window.scrollX}px`;
		this.elContainer.style.marginTop  = `-${rContainer.top + window.scrollY}px`;

		this.elContainer.style.display = 'none';

		pub(ContainerElementCreated, this.elContainer);

		sub(ElementsSelected, (Elements) => {
			this.SetCounter((new Set(Elements.Links.map((elem) => elem.href))).size);
		});

		sub(DragStarted, data => this.InsertElements());
		sub(DragCompleted, data => this.RemoveElements());
	}

	/**
	 * @param {number} top     The initial top coordinate (typically of the mousedown event)
	 * @param {number} left    The initial left coordinate (typically of the mousedown event)
	 *
	 * @returns {SelectionRect}
	 */
	SetOrigin(top, left) {
		this.dims.SetOrigin(top, left);

		return this;
	}

	/**
	 * Set the bottom right of the rect, really the current mouse coordinates
	 *
	 * @param {number} bottom        The bottom coordinate of the rect to set
	 * @param {number} right         The right coordinate of the rect to set
	 *
	 * @returns {SelectionRect}
	 */
	SetBottomRight(bottom, right) {
		let dr = (new DocRect(document))
			.Expand(-2, -2);

		let {width, height} = this.dims;

		/* Based on current fixed style */
		this.dims
			.SetBottomRight(bottom, right)
			.ClipTo(dr);

		if(width != this.dims.width || height != this.dims.height) {
			[this.elRect.style.top, this.elRect.style.left]     = [this.dims.top + 'px', this.dims.left + 'px'];
			[this.elRect.style.height, this.elRect.style.width] = [this.dims.height + 'px', this.dims.width + 'px'];

			if(this.IsLargeEnoughToActivate()) {
				this.elContainer.style.display = '';
				pub(DragRectChanged, { dims: this.dims, visible: true });
			} else {
				this.elContainer.style.display = 'none';
				pub(DragRectChanged, { dims: this.dims, visible: false });
			}
		}

		return this;
	}

	/**
	 * Sets the label for the rect to {count} Links
	 * @param {number} count    The count of the links to set the label to
	 *
	 * @returns {SelectionRect}
	 */
	SetCounter(count) {
		this.elRect.firstElementChild.innerHTML = `${count} Links`;

		return this.AlignCounter();
	}

	/**
	 * Re-aligns the label depending on the rect parameters
	 *
	 * @returns {SelectionRect}
	 */
	AlignCounter() {
		let style = this.elRect.firstElementChild.style,
			inset = Prefs.SelectionLabel_CursorMargin + 'px';

		let InvertedHorizontally = this.dims.originLeft != this.dims.left,
			InvertedVertically   = this.dims.originTop != this.dims.top;

		[style.right, style.left] =
			!InvertedHorizontally
			? [inset, '']
			: ['', inset];
		[style.bottom, style.top] =
			!InvertedVertically
			? [inset, '']
			: ['', inset];

		// move slightly to the right for not to be blocked by mouse pointer
		if(InvertedHorizontally && InvertedVertically)
			style.left = (Prefs.SelectionLabel_CursorMargin + 16) + 'px';

		style.display = Prefs.ShowNumberOfLinks
						? ''
						: 'none';

		return this;
	}

	/**
	 * Returns true if the rect is large enough to activate snap links
	 *
	 * @returns {boolean}
	 */
	IsLargeEnoughToActivate() {
		return this.dims.width > Prefs.Activation_Min || this.dims.height > Prefs.Activation_Min;
	}

	/**
	 * Called on DragStarted, inserts DOM elements to begin drag operations
	 *
	 * @returns {this}
	 */
	InsertElements() {
		document.head.appendChild(this.StyleNode);
		document.body.appendChild(this.elContainer);

		return this;
	}

	/**
	 * Called on DragCompleted.  Removes the elements from the DOM and resets internals
	 *
	 * @returns {this}
	 */
	RemoveElements() {
		this.dims = new Rect();

		this.elContainer.style.display = 'none';

		this.elContainer.remove();
		this.StyleNode.remove();

		return this;
	}
}
