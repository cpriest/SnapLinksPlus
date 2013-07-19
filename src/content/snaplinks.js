/*
 *  snaplinks.js
 *
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2009  Tommi Rautava
 *  Copyright (C) 2011, 2012  Clint Priest, Tommi Rautava
 *
 *  This file is part of Snap Links Plus.
 *
 *  Snap Links Plus is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links Plus is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

var EXPORTED_SYMBOLS = ["SnapLinksClass"];

var Cc = Components.classes,
	Cu = Components.utils,
	Ci = Components.interfaces;

try {
	Cu.import("resource://gre/modules/PlacesUtils.jsm");
	Cu.import("resource:///modules/PlacesUIUtils.jsm");
	Cu.import("chrome://snaplinksplus/content/Utility.js");
	Cu.import("chrome://snaplinksplus/content/WindowFaker.js");
	Cu.import('chrome://snaplinksplus/content/Selection.js');
	Cu.import('chrome://snaplinksplus/content/Preferences.js');
} catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

var SnapLinksClass = Class.create({
	Window: null,
	XulDocument: null,
	PanelContainer: null,

	ACTION: {
		NEW_TABS			: 'OpenTabs',
		NEW_WINDOWS			: 'OpenWindows',
		TABS_IN_NEW_WINDOW	: 'OpenTabsInNewWindow',
		COPY_TO_CLIPBOARD	: 'CopyToClipboard',
		BOOKMARK_LINKS		: 'BookmarkLinks',
		DOWNLOAD_LINKS		: 'DownloadLinks',
		ASK_USER			: 'AskUser',

		CLICK_ELEMENTS		: 'ClickElements'
	},
	
	COPY_TO_CLIPBOARD_SEPARATOR_ID: {
		CUSTOM: 0,
		NEWLINE: 1,
		TAB: 2
	},

	/**
	 * Returns an Mozilla URI pointed at the current documents referrer.
	 */
	DocumentReferer: {
		get: function() {
			try {return Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService)
						.newURI(this.Document.location.href, null, null); }
			catch(e) {
				Components.utils.reportError(e + ":\n"+ e.stack);
			}
			return null;
		}
	},

	/**
	 * Returns the selected clipboard separator.
	 */
	ClipboardSeparator: {
		get: function() {
			switch (SLPrefs.Actions.CopyToClipboard.SeparatorId) {
			case this.COPY_TO_CLIPBOARD_SEPARATOR_ID.CUSTOM:
				return unescape(SLPrefs.Actions.CopyToClipboard.Separator);
				break;
			case this.COPY_TO_CLIPBOARD_SEPARATOR_ID.NEWLINE:
				return "\n";
				break;
			case this.COPY_TO_CLIPBOARD_SEPARATOR_ID.TAB:
				return "\t";
				break;
			default:
				return "\n";
			}
		}
	},

	/**
	 * Setter to change the status text.
	 */
	SnapLinksStatus: {
		set: function(x) {
			if(SLPrefs.Selection.ShowCount &&
					SLPrefs.Selection.ShowCountWhere == SLE.ShowCount_AddonBar) {
				var el = this.XulDocument.getElementById('snaplinks-panel') ;
				el && (el.label = x);
				el && (el.hidden = (x == ''));
			}
		}
	},

	/**
	 * Setter to change the status bar text.
	 */
	StatusBarLabel: {
		set: function(x) {
			this.XulDocument.getElementById('statusbar-display').label = x;
		}
	},

	initialize: function(Window, XulDocument) {
		this.Window = Window;
		this.XulDocument = XulDocument;
		var StringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
		this.LocaleBundle = StringBundleService.createBundle("chrome://snaplinksplus/locale/snaplinks.properties");

		this.LocaleStrings = {
			Usage:		this.LocaleBundle.GetStringFromName("snaplinks.status.usage"),
			//Links:		this.LocaleBundle.GetStringFromName("snaplinks.status.links")
		};

		this._OnMouseMove 	= this.OnMouseMove.bind(this);

		this.PanelContainer = this.XulDocument.getElementById('content').mPanelContainer;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), false);
		this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
		this.PanelContainer.addEventListener('keypress', this.OnKeyPress.bind(this), true);
		
		this.XulDocument.getElementById('snaplMenu')
			.addEventListener('popuphidden',this.OnSnapLinksPopupHidden.bind(this),false);

		this.Selection = new SnapLinksSelectionClass(this);

		this.SnapLinksStatus = '';

		/* Install context menu popup prevention hook */
		this.StopNextContextMenuPopup = false;
		this.XulDocument.getElementById('contentAreaContextMenu').addEventListener('popupshowing', function (e) {
			if(this.StopNextContextMenuPopup)
				e.preventDefault();
			this.StopNextContextMenuPopup = false;
		}.bind(this), false);
	},

	/**
	 * Evaluates a given event looking to see if the button and modifier keys are present.
	 */
	ShouldActivate: function(e) {
		if(e.view.location.protocol == 'about:')
			return false;
		if(e.button != SLPrefs.Activation.Button)
			return false;
		if(SLPrefs.Activation.RequiresAlt && !e.altKey)
			return false;
		if(SLPrefs.Activation.RequiresShift && !e.shiftKey)
			return false;
		if(SLPrefs.Activation.RequiresCtrl && !e.ctrlKey)
			return false;
		return true;
	},

	UpdateStatusLabel: function() {
		this.StatusBarLabel = this.LocaleStrings.Usage;
	},

	OnMouseDown: function(e) {
		if(!this.ShouldActivate(e))
			return;

		this.Clear();
		
		/* Capture the current working document */
		this.Document = e.target.ownerDocument.defaultView.top.document;
		this.Document.body.setCapture(false);
		
		this.InstallEventHooks();

		/* On Linux the context menu occurs on mouse down, see bug: https://bugzilla.mozilla.org/show_bug.cgi?id=667218, 
			we prevent the context menu from showing on mouse down here. */
		if(e.button == 2 /* RMB */ && this.Window.navigator.userAgent.indexOf('Linux') != -1) {
			this.StopNextContextMenuPopup = true;
		}
	},

	OnMouseMove: function(e) {
//		this.UpdateStatusLabel();
	},

	OnMouseUp: function(e) {
		if(e.button != SLPrefs.Activation.Button)
			return;

		if(this.Document) {
			this.Document.releaseCapture();

			if(this.Selection.DragStarted == true) {
				this.StopNextContextMenuPopup = true;
				if((e.ctrlKey || SLPrefs.Actions.Default == this.ACTION.ASK_USER) &&
						this.Selection.SelectedElementsType == 'Links' &&
						this.Selection.FilteredElements.length) {
					pop = this.XulDocument.getElementById('snaplMenu');
					pop.openPopupAtScreen(e.screenX, e.screenY, true);
				} else
					this.ActivateSelection();
				e.preventDefault();
			} else {
				this.Clear();
				
				/* On Linux the context menu occurs on mouse down, see bug: https://bugzilla.mozilla.org/show_bug.cgi?id=667218
					we force the context menu to open up here*/
				if(this.Window.navigator.userAgent.indexOf('Linux') != -1) {
					if (this.Window.gContextMenu) {
						var evt = this.XulDocument.createEvent("MouseEvents");

						evt.initMouseEvent('contextmenu', true, true, this.Window, 0, 
							e.screenX, e.screenY, e.clientX, e.clientY,
							false, false, false, false,
							2, null);
						this.Window.gContextMenu.target.dispatchEvent(evt);
					}
				}
			}
		}
		/* Clear any StopNextContextMenuPopup regardless of it's use on next idle moment */
		this.Window.setTimeout(function() { this.StopNextContextMenuPopup = false; }.bind(this), 0);
	},

	InstallEventHooks: function() {
		this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
	},

	RemoveEventHooks: function() {
		this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
	},

	OnKeyPress: function(e) {
		if(e.keyCode == this.Window.KeyboardEvent.DOM_VK_ESCAPE)
			this.Clear();
	},

	/**
	 * This is fired when the context menu is closed.
	 */
	OnSnapLinksPopupHidden: function(e){
		this.Clear();
	},

	/**
	 * Clears the selection and our internal state.
	 */
	Clear: function() {
		this.Selection.Clear();

		this.StatusBarLabel = '';
		this.SnapLinksStatus = '';
		this.RemoveEventHooks();
		delete this.Document;
	},

	ActivateSelection: function(Action) {
		/* Hash of valid actions by SelectedElementType  */
		var ValidActions = {
			'Links':		[ 'OpenTabs','OpenWindows','OpenTabsInNewWindow','CopyToClipboard','BookmarkLinks','DownloadLinks' ],
			'JsLinks':		[ 'ClickLinks' ],
			'Buttons':		[ 'ClickElements' ],
			'Checkboxes':	[ 'ClickCheckboxes' ],
			'RadioButtons': [ 'ClickElements' ],
			'Clickable':	[ 'ClickElements'],
		};

		Action = Action || SLPrefs.Actions.Default;

		/* Check to see that the requested action is valid for the given SelectedElementsType */
		if(ValidActions[this.Selection.SelectedElementsType].indexOf(Action) == -1)
			Action = ValidActions[this.Selection.SelectedElementsType][0];
		
		if(this[Action])
			this[Action]();
		this.Clear();
	},

	/** CollectElementsInfo() -
	 *   New FF code makes closed page elements invalid almost immediately, this function
	 *   collects the needed info before processing begins
	 *
	 * @param FilteredElements
	 */
	CollectElementsInfo: function(FilteredElements) {
		var out = [ ];
		FilteredElements.forEach( function(elem) {
			var x = { };
			[ 'href', 'SnapIsJsLink' ].forEach( function(name) {
				x[name] = elem[name];
			});
			x.elem = elem;
			out.push( x );
		});
		return out;
	},

	/**
	 * Click selected JavaScript links one by one.
	 */
	ClickLinks: function() {
		try {
			var CollectedElementsInfo = this.CollectElementsInfo(this.Selection.FilteredElements);

			CollectedElementsInfo.forEach( function(info, index) {
				var callback = this;
				
				this.Window.setTimeout(function() {
					callback.ClickLink(info.elem);
				}, SLPrefs.Actions.DelayBetweenActions * index, callback);
			}, this );
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Click a single JavaScript link.
	 */
	ClickLink: function(elem) {
		if (elem.click) {
			elem.click();
			return;
		}
		
		/* This is needed for JavaScript links on
		 * Firefox 4.0 and SeaMonkey 2.1.
		 */
		var evt = this.Window.document.createEvent("MouseEvents");
		evt.initMouseEvent("click", true, true, this.Window, 0,
				0, 0, 0, 0,
				false, false, false, false,
				0, null);
		elem.dispatchEvent(evt);
	},

	/**
	 * Click elements (buttons, checkboxes) without a delay in between.
	 */
	ClickElements: function() {
		try {
			this.Selection.SelectedElements.forEach( function(elem, index) {
				elem.click();
			}, this );
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Click elements (buttons, checkboxes) without a delay in between.
	 */
	ClickCheckboxes: function() {
		try {
			var MixedState = false,
				FirstState = this.Selection.SelectedElements[0].checked;
			this.Selection.SelectedElements.forEach( function(elem, index) {
				if(MixedState == false && elem.checked != FirstState)
					MixedState = true;
			});

			this.Selection.SelectedElements.forEach( function(elem, index) {
				if(MixedState == false || SLPrefs.Elements.Checkboxes.MixedStateAction == SLE.CMSA_Toggle)
					elem.click();
				else if(SLPrefs.Elements.Checkboxes.MixedStateAction == SLE.CMSA_Check) {
					if(elem.checked  == false)
						elem.click();
				} else {
					if(elem.checked == true)
						elem.click();
				}
			}, this );
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Opens the selected element links in tabs in the current window.
	 */
	OpenTabs: function() {
		try {
			var CurrentReferer = this.DocumentReferer;
			var CollectedElementsInfo = this.CollectElementsInfo(this.Selection.FilteredElements);
			var TabsCreated = 0;
			var Browser = this.Window.getBrowser();
			var IntervalTimerID;

			var DelayedAction = function DelayedAction() {
				if(CollectedElementsInfo.length == 0) {
					//noinspection JSPotentiallyInvalidUsageOfThis
					this.Window.clearInterval(IntervalTimerID);
					return;
				}
				var info = CollectedElementsInfo.shift();

				if(info.href) {
					if (info.SnapIsJsLink) {
						this.ClickLink(info.elem); // Click JS links.
					} else {
						this.FireEventsForElement(info.elem);

						var NewTab = Browser.addTab(info.href, CurrentReferer);
						TabsCreated++;
						if(TabsCreated == 1 && SLPrefs.Actions.OpenTabs.SwitchToFirstNewTab)
							Browser.tabContainer.selectedItem = NewTab;
					}
				}
			};
			IntervalTimerID = this.Window.setInterval(DelayedAction.bind(this), SLPrefs.Actions.DelayBetweenActions);
			DelayedAction.call(this);
		}
		catch(e) {
			Components.utils.reportError(e + ":\n"+ e.stack);
		}
	},

	/** Opens a javascript link into a new tab. */
/*
	OpenJsInTab: function(elem) {
		try {
			// Duplicate the current page on a new tab.
			var docHref = this.Document.location.href;
			var newTab = getBrowser().addTab(docHref, this.DocumentReferer);
			
			// Run our code when the new tab is ready.
			var newTabBrowser = gBrowser.getBrowserForTab(newTab);
			newTabBrowser.addEventListener("load", function () {
				// Get the body element.
				var body = newTabBrowser.contentDocument.body;
				var dupeElem;
				
				// If the link element has an ID, lets use it.
				if (elem.id) {
					dupeElem = body.getElementById(elem.id);
					if (dupeElem) {
						dupeElem.click();
					}
				} else {
					// Oh well, let's do this the hard way.
					var links = body.getElementsByTagName("A");
					for (var i = links.length - 1; i >= 0; --i) {
						dupeElem = links[i];
						if (dupeElem.href == elem.href) {
							dupeElem.click();
							break;
						}
					}
				}
			}, true);
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},
*/

	/**
	 * Opens the selected links in new windows.
	 */
	OpenWindows: function() {
		try {
			var CollectedElementsInfo = this.CollectElementsInfo(this.Selection.FilteredElements);

			CollectedElementsInfo.forEach( function(info, index) {
				this.Window.setTimeout(function() {
					this.FireEventsForElement(info.elem);
					if(info.href)
						this.Window.open(info.href);
				}.bind(this), SLPrefs.Actions.DelayBetweenActions * index);
			}, this );
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Opens the selected links in one new window.
	 */
	OpenTabsInNewWindow: function() {
		try {
			if(this.Selection.FilteredElements.length) {
				this.Selection.FilteredElements.forEach(function(elem) {
					this.FireEventsForElement(elem);
				}.bind(this));

				var urls = this.Selection.FilteredElements.map( function(elem) {
					return elem.href;
				}, this ).join('|');
	
				return this.Window.openDialog("chrome://browser/content/", "_blank", "all,chrome,dialog=no", urls);
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
		
		return null;
	},

	/**
	 * Copies the selected links to the clip board.
	 */
	CopyToClipboard: function() {
		try {
			var textSeparator = this.ClipboardSeparator;
			var htmlSeparator = textSeparator.replace(/\n/g, "<br>\n");
			
			var Representations = this.Selection.FilteredElements.reduce( function(acc, elem) {
				var text = htmlentities(elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '));
	
				acc.html.push( '<a href="' + escapeHTML(elem.href) + '">' + text + '</a>' );
				acc.text.push( escapeHTML(elem.href) );
				return acc;
			}, { html: [ ], text: [ ] } );
	
			// Create the transferable
			var objData = Components.classes["@mozilla.org/widget/transferable;1"]
							.createInstance(Components.interfaces.nsITransferable);
	
			if(objData) {
				var TextContent = Components.classes["@mozilla.org/supports-string;1"]
									.createInstance(Components.interfaces.nsISupportsString);
				if(TextContent) {
					TextContent.data = Representations.text.join(textSeparator);
	
					objData.addDataFlavor('text/unicode');
					objData.setTransferData('text/unicode', TextContent, TextContent.data.length * 2);	/* Double byte data (len*2) */
				}
	
				var HtmlContent = Components.classes["@mozilla.org/supports-string;1"]
									.createInstance(Components.interfaces.nsISupportsString);
				if(HtmlContent) {
					HtmlContent.data = Representations.html.join(htmlSeparator);
	
					objData.addDataFlavor('text/html');
					objData.setTransferData('text/html', HtmlContent, HtmlContent.data.length * 2);	/* Double byte data (len*2) */
				}
	
				var objClipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
									.getService(Components.interfaces.nsIClipboard);
				if (objClipboard)
					objClipboard.setData(objData, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Bookmarks the selected links.
	 */
	BookmarkLinks: function() {
		try {
			var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);

			if(this.Selection.FilteredElements.length) {
				var uriList = this.Selection.FilteredElements.map( function(elem) {
					return ioService.newURI(elem.href, null, null);
				}, this );
				
				// Use showBookmarkDialog() when it is available.
				if (PlacesUIUtils.showBookmarkDialog) {
					/* See documentation at the top of bookmarkProperties.js (Mozilla). */
					var info = {
							action: "add",
							type: "folder",
							hiddenRows: ["description"],
							URIList: uriList
					};
					
					PlacesUIUtils.showBookmarkDialog(info, this.Window);
				} else {
					// Fallback to older showMinimalAddMultiBookmarkUI().
					PlacesUIUtils.showMinimalAddMultiBookmarkUI(uriList);
				}
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},

	/**
	 * Downloads the selected links as files.
	 */
	DownloadLinks: function() {
		try {
			if(this.Selection.FilteredElements.length) {
				var TitlesUsed = { };
	
				var links = this.Selection.FilteredElements.map( function(elem) {
					var Title = elem.textContent.replace(/\s{2,}/g, ' ').replace(/ /g,'_').replace(/[^a-zA-Z0-9_]+/g, '').substring(0, 75);
	
					/* Ensure Uniqueness of Filename */
					for(var j=0;j<99;j++) {
						var TitleCheck = Title;
						if(j > 0)
							TitleCheck += '' + j;
						if(TitlesUsed[TitleCheck] == undefined) {
							Title = TitleCheck;
							break;
						}
					}
					TitlesUsed[Title] = true;
	
					return { FileName: Title, Url: elem.href };
				}, this );
				
				var CurrentReferer = this.DocumentReferer;
				
				var pref = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
				var useDownloadDir = pref.getBoolPref("browser.download.useDownloadDir");

				if (useDownloadDir && !SLPrefs.Actions.Download.PromptForName) {
					links.forEach( function( link, index ) {
						var callback = this;
						
						this.Window.setTimeout(function() {
							saveURL(link.Url, link.FileName, null, true, true, CurrentReferer);
						}, SLPrefs.Actions.DelayBetweenActions * index, callback, link);
					}, this);
				} else {
					links.forEach( function( link, index ) {
						// saveURL(aURL, aFileName, aFilePickerTitleKey, aShouldBypassCache, aSkipPrompt, aReferrer)
						saveURL(link.Url, link.FileName, null, true, false, CurrentReferer);
					}, this);
				}
			}
		}
		catch(e) {
			Components.utils.reportError(e);
		}
	},

	FireEventsForElement: function(elem) {
		let MouseEvent = this.Window.MouseEvent;

		/* Hidden features that enable users (through about:config) to enable firing of mousedown/mouseup events
			on links prior to their being opened, see: https://github.com/cpriest/SnapLinksPlus/issues/7 */
		if(SLPrefs.Special.FireEventsOnLinks.MouseDown) {
			let me = new MouseEvent('mousedown', { view: this.Window, bubbles: false, cancelable: true} );
			me.preventDefault();
			elem.dispatchEvent(me);
		}
		if(SLPrefs.Special.FireEventsOnLinks.MouseUp) {
			let me = new MouseEvent('mouseup', { view: this.Window, bubbles: false, cancelable: true} );
			me.preventDefault();
			elem.dispatchEvent(me);
		}
	}
});
