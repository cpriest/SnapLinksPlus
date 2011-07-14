/*
 *  snaplinks.js
 *
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Atreus, MumblyJuergens
 *  Copyright (C) 2009  Tommi Rautava
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
 *
 *  This file is part of Snap Links.
 *
 *  Snap Links is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links.  If not, see <http://www.gnu.org/licenses/>.
 */

const snaplLMB  = 0;
const snaplMMB  = 1;
const snaplRMB  = 2;

SnapLinks = new (Class.create({
	/* Returns an Mozilla URI pointed at the current documents referrer */
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
	/* Setter to change the snap links status text */
	SnapLinksStatus: {
		set: function(x) {
			if(SnapLinks.Prefs.ShowCountWhere == SnapLinks.Prefs.ShowCount_AddonBar) {
				var el = document.getElementById('snaplinks-panel') ;
				el && (el.label = x);
				el && (el.hidden = (x == ''));
			}
		}
	},
	/* Setter to change the status bar text */
	StatusBarLabel: {	set: function(x) { document.getElementById('statusbar-display').label = x; }	},

	initialize: function() {

		var StringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
		var LocaleStrings = StringBundleService.createBundle("chrome://snaplinks/locale/snaplinks.properties");
		
		this.LocaleStrings = {
			Usage:		LocaleStrings.GetStringFromName("snaplinks.status.usage"),
			Links:		LocaleStrings.GetStringFromName("snaplinks.panel.links")
		};

		this._OnMouseMove 	= this.OnMouseMove.bind(this);

		this.PanelContainer = document.getElementById('content').mPanelContainer;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), false);
		this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
		this.PanelContainer.addEventListener('keypress', this.OnKeyPress.bind(this), true);

		document.getElementById('snaplMenu')
			.addEventListener('popuphidden',this.OnSnapLinksPopupHidden.bind(this),false);

		this.Selection = new Selection(this.PanelContainer);

		this.SnapLinksStatus = '';

		/* Import anything already defined into SnapLinks.* (like Prefs) */
		Object.keys(SnapLinks).forEach( function(Name) {
			this[Name] = SnapLinks[Name];
		}, this);
	},
	
	/* Evaluates a given event looking to see if the button and modifier keys are present */
	ShouldActivate: function(e) {
		if(e.button != SnapLinks.Prefs.SelectionButton)
			return false;
		if(SnapLinks.Prefs.ActivateRequiresAlt && !e.altKey)
			return false;
		if(SnapLinks.Prefs.ActivateRequiresShift && !e.shiftKey)
			return false;
		if(SnapLinks.Prefs.ActivateRequiresCtrl && !e.ctrlKey)
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
		this.Document = e.target.ownerDocument;
		this.Document.body.setCapture(false);

		this.InstallEventHooks();

		/* On Linux the context menu occurs on mouse down, see bug: https://bugzilla.mozilla.org/show_bug.cgi?id=667218, 
			we prevent the context menu from showing on mouse down here. */
		if(navigator.userAgent.indexOf('Linux') != -1) {
			this.StopNextContextMenuPopup();
		}
	},

	OnMouseMove: function(e) {
//		this.UpdateStatusLabel();
	},

	OnMouseUp: function(e) {
		if(e.button != SnapLinks.Prefs.SelectionButton)
			return;

		if(this.Document) {
			this.Document.releaseCapture();

			if(this.Selection.DragStarted == true) {
				this.StopNextContextMenuPopup();
				if((e.ctrlKey || SnapLinks.Prefs.DefaultAction == this.ACTION.ASK_USER) && this.Selection.SelectedElementsType == 'Links') {
					pop = document.getElementById('snaplMenu');
					pop.openPopupAtScreen(e.screenX, e.screenY, true);
				} else
					this.ActivateSelection();
			} else {
				SnapLinks.Clear();
				
				/* On Linux the context menu occurs on mouse down, see bug: https://bugzilla.mozilla.org/show_bug.cgi?id=667218
					we force the context menu to open up here*/
				if(navigator.userAgent.indexOf('Linux') != -1) {
					if (gContextMenu) {
						var evt = document.createEvent("MouseEvents");
						var le = this.LastMouseDownEvent;
					
						evt.initMouseEvent('contextmenu', true, true, window, 0, 
							e.screenX, e.screenY, e.clientX, e.clientY,
							false, false, false, false, 2, null);
						gContextMenu.target.dispatchEvent(evt);
					}
				}
			}
		}
	},

	InstallEventHooks: function() {
		this.PanelContainer.addEventListener('mousemove', this._OnMouseMove, true);
	},

	RemoveEventHooks: function() {
		this.PanelContainer.removeEventListener('mousemove', this._OnMouseMove, true);
	},

	OnKeyPress: function(e) {
		if(e.keyCode == KeyboardEvent.DOM_VK_ESCAPE)
			this.Clear();
	},

	/** Called to prevent the next context menu popup from showing */
	StopNextContextMenuPopup: function() {
		if(this.StoppingNextContextMenuPopup)
			return;

		this.StoppingNextContextMenuPopup = true;

		var ContentAreaContextMenu = document.getElementById('contentAreaContextMenu');
		var _PreventEventDefault;
		function PreventEventDefault(e) {
			e.preventDefault();
			this.StoppingNextContextMenuPopup = false;
			ContentAreaContextMenu.removeEventListener('popupshowing', _PreventEventDefault, false);
		}
		_PreventEventDefault = PreventEventDefault.bind(this);
		ContentAreaContextMenu.addEventListener('popupshowing', _PreventEventDefault, false);
	},
	
	/* This is fired when the snap links context menu is closed */
	OnSnapLinksPopupHidden: function(e){
		SnapLinks.Clear();
	},

	/* Clears the selection and our internal state */
	Clear: function() {
		this.Selection.Clear();

		this.StatusBarLabel = '';
		this.SnapLinksStatus = '';
		this.RemoveEventHooks();
		delete this.Document;
	},

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
	
	ActivateSelection: function(Action) {
		/* Hash of valid actions by SelectedElementType  */
		var ValidActions = {
			'Links':		[ 'OpenTabs','OpenWindows','OpenTabsInNewWindow','CopyToClipboard','BookmarkLinks','DownloadLinks' ],
			'Buttons':		[ 'ClickElements' ],
			'Checkboxes':	[ 'ClickElements' ]
		};

		Action = Action || SnapLinks.Prefs.DefaultAction;
		
		/* Check to see that the requested action is valid for the given SelectedElementsType */
		if(ValidActions[this.Selection.SelectedElementsType].indexOf(Action) == -1)
			Action = ValidActions[this.Selection.SelectedElementsType][0];
		
		if(this[Action])
			this[Action]();
		this.Clear();
	},

	ClickElements: function() {
		this.Selection.SelectedElements.forEach( function(elem) {
			elem.click();
		} );
	},
	
	/* Opens the selected element links in tabs in the current window */
	OpenTabs: function() {
		try {
			this.Selection.FilteredElements.forEach( function(elem) {
				if(elem.href)
					getBrowser().addTab(elem.href, this.DocumentReferer);
			}, this);
		}
		catch(e) {
			Components.utils.reportError(e + ":\n"+ e.stack);
		}
	},
	/* Opens the selected links in new windows */
	OpenWindows: function() {
		SnapLinks.Selection.FilteredElements.forEach( function(elem) {
			if(elem.href)
				window.open(elem.href);
		} );
	},
	/* Opens the selected links in one new window */
	OpenTabsInNewWindow: function() {
		if(SnapLinks.Selection.FilteredElements.length) {
			var urls = SnapLinks.Selection.FilteredElements.map( function(elem) {
				return elem.href;
			} ).join('|');

			return window.openDialog("chrome://browser/content/", "_blank", "all,chrome,dialog=no", urls);
		}
	},
	/* Copies the selected links to the clip board */
	CopyToClipboard: function() {
		var Representations = SnapLinks.Selection.FilteredElements.reduce( function(acc, elem) {
			var text = elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');

			acc.html.push( '<a href="' + elem.href + '">' + text + '</a>' );
			acc.text.push( elem.href );
			return acc;
		}, { html: [ ], text: [ ] } );

		// Create the transferable
		var objData = Components.classes["@mozilla.org/widget/transferable;1"]
						.createInstance(Components.interfaces.nsITransferable);

		if(objData) {
			var TextContent = Components.classes["@mozilla.org/supports-string;1"]
								.createInstance(Components.interfaces.nsISupportsString);
			if(TextContent) {
				TextContent.data = Representations.text.join(unescape(SnapLinks.Prefs.CopyToClipboardSeparator));

				objData.addDataFlavor('text/unicode');
				objData.setTransferData('text/unicode', TextContent, TextContent.data.length * 2);	/* Double byte data (len*2) */
			}

			var HtmlContent = Components.classes["@mozilla.org/supports-string;1"]
								.createInstance(Components.interfaces.nsISupportsString);
			if(HtmlContent) {
				HtmlContent.data = Representations.html.join(unescape(SnapLinks.Prefs.CopyToClipboardSeparator));

				objData.addDataFlavor('text/html');
				objData.setTransferData('text/html', HtmlContent, HtmlContent.data.length * 2);	/* Double byte data (len*2) */
			}

			var objClipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
								.getService(Components.interfaces.nsIClipboard);
			if (objClipboard)
				objClipboard.setData(objData, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		}
	},
	/* Bookmarks the selected links */
	BookmarkLinks: function() {
		if(SnapLinks.Selection.FilteredElements.length) {
			/* Does not work, find way to add bookmarks to FF4 - @BROKEN */
			var linksInfo = SnapLinks.Selection.FilteredElements.map( function(elem) {
				return {
					name	: elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '),
					url		: elem.href
				};
			} );
			const BROWSER_ADD_BM_FEATURES = 'centerscreen,chrome,dialog=no,resizable=yes';

			var dialogArgs = { name: gNavigatorBundle.getString("bookmarkAllTabsDefault") };
			dialogArgs.bBookmarkAllTabs = true;
			dialogArgs.objGroup = linksInfo;
			openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "", BROWSER_ADD_BM_FEATURES, dialogArgs);
		}
	},
	/* Downloads the selected links as files */
	DownloadLinks: function() {
		if(SnapLinks.Selection.FilteredElements.length) {
			var TitlesUsed = { };

			var links = SnapLinks.Selection.FilteredElements.map( function(elem) {
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
			} );
			links.forEach( function( link ) {
				const BYPASS_CACHE = true;
				const DONT_SKIP_PROMPT = false;

				try { saveURL(link.Url, link.FileName, false, BYPASS_CACHE, DONT_SKIP_PROMPT, this.DocumentReferer); }
					catch(e) { }
			} );
		}
	}
}))();


