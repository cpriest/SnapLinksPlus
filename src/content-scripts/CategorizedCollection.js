'use strict';

const CT_LINKS        = 'Links',
	  CT_CLICKABLE    = 'Clickable',
	  CT_CHECKBOXES   = 'Checkboxes',
	  CT_RADIOBUTTONS = 'Radio Buttons';

/**
 * This class categorizes a collection of selected elements and provide utilities around the collection of {Element}s
 *
 * @property {string}                GreatestType    The CT_* constant representing the greatest number of elements among the categories
 *
 * @property {Element[]}             Links           The A elements in the collection
 * @property {HTMLInputElement[]}    Buttons         The INPUT elements in the collection that are buttons
 * @property {HTMLInputElement[]}    Checkboxes      The INPUT elements in the collection that are checkboxes
 * @property {HTMLInputElement[]}    RadioButtons    The INPUT elements in the collection that are radio buttons
 */
class CategorizedCollection {
	/**
	 * @param {Element[]|Set} tElems    The elements to categorize
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
	 * @param {Element[]} tElems    The elements to categorize
	 */
	CategorizeMatches(tElems) {
		this.Links             = [];
		this.FilteredLinks     = [];
		this.Clickable         = [];
		this.FilteredClickable = [];
		this.Checkboxes        = [];
		this.RadioButtons      = [];
		this.Unknown           = [];

		for(let elem of tElems) {
			if(this.CategorizeByTag(elem))
				continue;
			if(this.CategorizeByAttributes(elem))
				continue;

			if(Prefs.DevMode)
				this.Unknown.push(elem);
		}

		//noinspection JSBitwiseOperatorUsage
		if(!(LastModifierKeys & ALT) && !Prefs.DisableFontWeightFiltering) {
			if(this.Links.length)
				[this.Links, this.FilteredLinks] = this.FilterByFontScore(this.Links);

			if(this.Clickable.length)
				[this.Clickable, this.FilteredClickable] = this.FilterByFontScore(this.Clickable);
		}

		// Pre-calculate greatest count of categorized elements
		let GreatestCount = 0;

		for(let [t, c] of this.Counts) {
			if(c > GreatestCount) {
				this.GreatestType = t;
				GreatestCount     = c;
			}
		}
		if(Prefs.DevMode && this.Unknown.length) {
			console.log('Didn\'t know what to do with %d elements:', this.Unknown.length);
			console.log(this.Unknown);
		}
	}

	/**
	 * Identifies elements that match certain tag names
	 *
	 * @param {Clickable} elem    The element being checked
	 *
	 * @return {boolean} True if element was handled
	 */
	CategorizeByTag(elem) {
		switch(elem.tagName) {
			case 'A':
				if(elem.href.length === 0 || elem.href.substr(0, 11) == 'javascript:')
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
				this.Clickable.push(elem);
				return true;
		}
		return false;
	}

	/**
	 * Identifies elements that match certain element attributes
	 *
	 * @param {Clickable} elem    The element being checked
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
	 * @return {[ Element[], Element[] ]}        [ GreatestScoreElements, FilteredElements ]
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
			.sort()
			.reverse()
			.shift();

		let HighScoreElems = ScoredElems[HighScore];
		delete ScoredElems[HighScore];

		return [HighScoreElems, [].concat(...Object.values(ScoredElems))];
	}
}
