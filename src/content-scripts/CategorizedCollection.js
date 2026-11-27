'use strict';

/* exported CategorizedCollection */

const CT_LINKS        = 'Links',
		CT_CLICKABLE    = 'Clickable',
		CT_CHECKBOXES   = 'Checkboxes',
		CT_RADIOBUTTONS = 'Radio Buttons';

/**
 * This class categorizes a collection of selected elements and provide utilities around the collection of {Element}s
 *
 * @property {string}				GreatestType	The CT_* constant representing the greatest number of elements among the categories
 *
 * @property {Element[]}			 Links			The A elements in the collection
 * @property {HTMLInputElement[]}	Buttons		 The INPUT elements in the collection that are buttons
 * @property {HTMLInputElement[]}	Checkboxes		The INPUT elements in the collection that are checkboxes
 * @property {HTMLInputElement[]}	RadioButtons	The INPUT elements in the collection that are radio buttons
 */
class CategorizedCollection {
	/**
	 * @param {Element[]|Set} tElems	The elements to categorize
	 */
	constructor(tElems = []) {
		if(!tElems || !tElems[Symbol.iterator])
			throw new TypeError('CategorizedCollection requires an interable for its first parameter.');

		this.CategorizeMatches(Array.from(tElems));
	}

	/**
	 * An alias for the collection of the greatest number of elements among the categories
	 *
	 * @return {Element[]}
	 */
	get Greatest() { return this[this.GreatestType]; }

	/**
	 * An alias for returning a collection of all {Element}s in all categories
	 *
	 * @returns {Element[]}
	 */
	get All() { return this.Links.concat(this.Clickable, this.Checkboxes, this.RadioButtons); }

	/**
	 * The elements the action acts upon: the greatest category, with one link per URL (the one that shows the most text)
	 *
	 * @returns {Element[]}
	 */
	get ActOn() {
		if(!this.GreatestType)
			return [];
		if(this.GreatestType != CT_LINKS)
			return this.Greatest;

		let Shown = new Set(UniqueLinks([...this.Links].sort((a, b) => this.ShownText(b).length - this.ShownText(a).length)));

		return this.Links.filter(elem => Shown.has(elem));
	}

	/**
	 * Returns a {Map} of element counts by CT_* Category
	 *
	 * @returns {Map}
	 */
	get Counts() {
		let Counts = new Map();
		Counts.set(CT_LINKS, this.Links.length);
		Counts.set(CT_CLICKABLE, this.Clickable.length);
		Counts.set(CT_CHECKBOXES, this.Checkboxes.length);
		Counts.set(CT_RADIOBUTTONS, this.RadioButtons.length);
		return Counts;
	}

	/**
	 * Categorizes an array of HtmlElements by categories such as Links, Buttons, etc.
	 *
	 * @private
	 *
	 * @param {Element[]} tElems	The elements to categorize
	 */
	CategorizeMatches(tElems) {
		this.Links             = [];
		this.FilteredLinks     = [];
		this.Clickable         = [];
		this.FilteredClickable = [];
		this.Checkboxes        = [];
		this.RadioButtons      = [];
		this.Unknown           = [];
		this.TextCache         = new Map();

		for(let elem of tElems) {
			if(this.CategorizeByTag(elem))
				continue;
			if(this.CategorizeByAttributes(elem))
				continue;

			if(Prefs.DevMode)
				this.Unknown.push(elem);
		}
		this.Clickable = this.Clickable.filter(elem => !this.IsPageControl(elem));

		// Drop icon-only links (vote arrows, share icons) when the lasso holds anything that shows content
		//noinspection JSBitwiseOperatorUsage
		if(!(LastModifierKeys & ALT) && (this.Checkboxes.length || this.RadioButtons.length || this.Links.some(elem => this.ShowsContent(elem))))
			this.Links = this.Links.filter(elem => this.ShowsContent(elem));

		//noinspection JSBitwiseOperatorUsage
		if(!(LastModifierKeys & ALT) && !Prefs.DisableFontWeightFiltering) {
			if(this.Links.length)
				[this.Links, this.FilteredLinks] = this.FilterByFontScore(this.Links);

			if(this.Clickable.length)
				[this.Clickable, this.FilteredClickable] = this.FilterByFontScore(this.Clickable);
		}

		// Pre-calculate greatest count of categorized elements; clickable elements win only when nothing else is selected (#282)
		let GreatestCount = 0;

		for(let [t, c] of this.Counts) {
			if(t != CT_CLICKABLE && c > GreatestCount) {
				this.GreatestType = t;
				GreatestCount     = c;
			}
		}
		if(!GreatestCount && this.Clickable.length)
			this.GreatestType = CT_CLICKABLE;
		if(Prefs.DevMode && this.Unknown.length) {
			console.log('Didn\'t know what to do with %d elements:', this.Unknown.length);
			console.log(this.Unknown);
		}
	}

	/**
	 * Identifies elements that match certain tag names
	 *
	 * @param {ClickableElement} elem	The element being checked
	 *
	 * @return {boolean} True if element was handled
	 */
	CategorizeByTag(elem) {
		switch(elem.tagName) {
			case 'A':
				if(elem.href.length === 0 || elem.href.substr(0, 11) == 'javascript:' || this.IsScriptAnchor(elem))
					this.Clickable.push(elem);
				else
					this.Links.push(elem);
				return true;
			case 'INPUT':
				/** @var {HTMLInputElement} [elem] */
				switch(elem.type.toLowerCase()) {
					case 'submit':
					case 'reset':
					case 'button':
						this.Clickable.push(elem);
						return true;
					case 'checkbox':
						this.Checkboxes.push(elem);
						return true;
					case 'radio':
						this.RadioButtons.push(elem);
						return true;
				}
				break;
			case 'BUTTON':
				// Another role (tab, combobox) makes it another widget; role=link has no URL to open, so it is clicked
				if(!['button', 'link'].includes((elem.getAttribute('role') || 'button').toLowerCase()))
					return false;
				this.Clickable.push(elem);
				return true;
		}
		return false;
	}

	/**
	 * Whether a link is href="#" to its own page, which only runs a script of the page (like javascript:)
	 *
	 * @param {HTMLAnchorElement} elem	The link being checked
	 *
	 * @return {boolean}
	 */
	IsScriptAnchor(elem) {
		return elem.href.endsWith('#') && elem.href.slice(0, -1) == location.href.split('#')[0];
	}

	/**
	 * Whether an element shows text, a picture, or is larger than an icon
	 *
	 * @param {Element} elem	The element being checked
	 *
	 * @return {boolean}
	 */
	ShowsContent(elem) {
		if(this.ShowsText(elem) || elem.querySelector('img, picture, video, canvas, input[type="image"]') !== null)
			return true;

		let { width, height } = elem.getBoundingClientRect();
		return width > 48 && height > 48;
	}

	/**
	 * Whether an element shows a letter, digit or punctuation, not only a symbol (★, ×) or an icon font's glyph
	 *
	 * @param {Element} elem	The element being checked
	 *
	 * @return {boolean}
	 */
	ShowsText(elem) {
		return /[\p{L}\p{N}\p{P}]/u.test(this.ShownText(elem));
	}

	/**
	 * Whether a button shows a label: a word, not only a count ("17" or "1.2K" next to a like icon)
	 *
	 * @param {Element} elem	The element being checked
	 *
	 * @return {boolean}
	 */
	ShowsLabel(elem) {
		return /\p{L}/u.test(this.ShownText(elem).replace(/\d[\d.,\s]*[KMB]?\b/gi, ''));
	}

	/**
	 * The text an element shows (innerText, or textContent for SVG), cached for this collection
	 *
	 * @param {Element} elem	The element
	 *
	 * @return {string}
	 */
	ShownText(elem) {
		if(!this.TextCache.has(elem))
			this.TextCache.set(elem, (elem.innerText ?? elem.textContent).trim());
		return this.TextCache.get(elem);
	}

	/**
	 * Whether a clickable element is part of the page's own UI: opens a menu, toggles, is disabled, or shows only an icon or a count
	 *
	 * @param {Element} elem	The clickable element being checked
	 *
	 * @return {boolean}
	 */
	IsPageControl(elem) {
		let popup = elem.getAttribute('aria-haspopup');

		if((popup !== null && popup.toLowerCase() != 'false') || elem.hasAttribute('aria-expanded') || elem.hasAttribute('aria-pressed'))
			return true;
		if(elem.disabled === true || elem.matches(':disabled') || (elem.getAttribute('aria-disabled') || '').toLowerCase() == 'true')
			return true;

		// An input button shows its value, or a default label (Submit, Reset) without one
		return elem.tagName != 'INPUT' && !this.ShowsLabel(elem);
	}

	/**
	 * Identifies elements that match certain element attributes
	 *
	 * @param {ClickableElement} elem	The element being checked
	 *
	 * @return {boolean} True if element was handled
	 */
	CategorizeByAttributes(elem) {
		if(elem.hasAttribute('aria-checked')) {
			this.Checkboxes.push(elem);
			return true;
		}

		let role = (elem.getAttribute('role') || '').toLowerCase();
		switch(role) {
			case 'checkbox':
				this.Checkboxes.push(elem);
				return true;
			case 'button':
				this.Clickable.push(elem);
				return true;
			case 'link':
				this.Links.push(elem);
				return true;
			case 'radio':
				this.RadioButtons.push(elem);
				return true;
		}
		return false;
	}

	/**
	 * Scores the elements by their font score and returns the separated elements.
	 *
	 * @param {Element[]} Elements
	 *
	 * @return {[ Element[], Element[] ]}		[ GreatestScoreElements, FilteredElements ]
	 */
	FilterByFontScore(Elements) {
		let ScoredElems = Elements
			.reduce((acc, elem) => {
				let Score  = ElemDocRects.GetFontScore(elem);
				acc[Score] = (acc[Score] || []);
				acc[Score].push(elem);
				return acc;
			}, {});

		let HighScore = Object.keys(ScoredElems)
			.sort((a, b) => b - a)
			.shift();

		let HighScoreElems = ScoredElems[HighScore];
		delete ScoredElems[HighScore];

		return [HighScoreElems, [].concat(...Object.values(ScoredElems))];
	}
}
