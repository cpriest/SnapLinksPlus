/*
 *  Copyright (C) 2011  Clint Priest
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

//	setTimeout( function() {
//		var a = Class.create( {
//			initialize: function() { Log('TestInheritence: 1'); }
//		});
//		var b = Class.create(a, {
//			initialize: function($super) { $super(); Log('TestInheritence: 2'); }
//		});
//		
//		var ib = new b();
//	}, 1000);

 
var snaplDrawing = false;

const snaplLMB  = 0;
const snaplMMB  = 1;
const snaplRMB  = 2;

var snaplButton;

var snaplBorderColor = '#30AF00';
var snaplLinksBorderColor = '#FF0000';

var snaplBorderWidth=3;
var snaplLinksBorderWidth=1;

var snaplTargetDoc;
var snaplShowNumber;
//var snaplStopPopup;

const SNAPLACTION_UNDEF=0;
const SNAPLACTION_TABS=1;
const SNAPLACTION_WINDOWS=2;
const SNAPLACTION_WINDOW=3;
const SNAPLACTION_CLIPBOARD=4;
const SNAPLACTION_BOOKMARK=5;
const SNAPLACTION_DOWNLOAD=6;
var SNAPLACTION_DEFAULT=SNAPLACTION_TABS;

var gsnaplinksBundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
var localeStrings = gsnaplinksBundle.createBundle("chrome://snaplinks/locale/snaplinks.properties");
var msgStatusUsage = localeStrings.GetStringFromName("snaplinks.status.usage");
var msgStatusLoading = localeStrings.GetStringFromName("snaplinks.status.loading");
var msgPanelLinks =  localeStrings.GetStringFromName("snaplinks.panel.links");

SnapLinks = new (Class.create({
	DocumentReferer: { 
		get: function() {
			try {return Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService)
						.ioService.newURI(this.Document.location.href, null, null); }
			catch(e) { }
			return null;
		}
	},	
	SnapLinksStatus: {
		set: function(x) {
			var el = document.getElementById('snaplinks-panel') ;
			el && (el.label = x);
			el && (el.hidden = (x == ''));
		} 
	},
	StatusBarLabel: {	set: function(x) { document.getElementById('statusbar-display').label = x; }	},
	
	initialize: function() {
		snaplButton = snaplRMB;
		this._OnMouseMove 	= this.OnMouseMove.bind(this);

		this.PanelContainer = document.getElementById('content').mPanelContainer;
		this.PanelContainer.addEventListener('mousedown', this.OnMouseDown.bind(this), true);
		this.PanelContainer.addEventListener('mouseup', this.OnMouseUp.bind(this), true);
		this.PanelContainer.addEventListener('keypress', this.OnKeyPress.bind(this), true);

		document.getElementById('snaplMenu')
			.addEventListener('popuphidden',this.OnSnapLinksPopupHidden.bind(this),false)

		this.Selection = new Selection(this.PanelContainer);

		this.SnapLinksStatus = '';
	},
			
	UpdateStatusLabel: function() {
		this.StatusBarLabel = msgStatusUsage;
	},
	
	OnMouseDown: function(e) {
		if(e.button != snaplButton)
			return;

		this.Document = e.target.ownerDocument;
		this.Document.body.setCapture(false);
		
//		snaplStopPopup = true;
		
		this.Clear();

		this.InstallEventHooks();
	},
	
	OnMouseMove: function(e) {
//		this.UpdateStatusLabel();
	},
	
	OnMouseUp: function(e) {
		if(e.button != snaplButton)
			return;

		this.Document.releaseCapture();
		
		if(this.Selection.DragStarted == true){
//			snaplStopPopup=true;
			this.StopNextContextMenuPopup();
			if(e.ctrlKey) {
				pop = document.getElementById('snaplMenu');
				pop.openPopupAtScreen(e.screenX, e.screenY, true);
			} else
				this.ActivateSelection();
		} else {
			SnapLinks.Clear();
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
	
	OnSnapLinksPopupHidden: function(e){
		SnapLinks.Clear();
	},
	
	Clear: function() {
		this.Selection.Clear();
					
		this.StatusBarLabel = '';
		this.SnapLinksStatus = '';
		this.RemoveEventHooks();
	},

	ACTION: {
		DEFAULT				: 'OpenTabs',
		NEW_TABS			: 'OpenTabs',
		NEW_WINDOWS			: 'OpenWindows',
		TABS_IN_NEW_WINDOW	: 'OpenTabsInNewWindow',
		COPY_TO_CLIPBOARD	: 'CopyToClipboard',
		BOOKMARK_LINKS		: 'BookmarkLinks',
		DOWNLOAD_LINKS		: 'DownloadLinks',
	},
	
	ActivateSelection: function(Action) {
		Action = Action || this.ACTION.DEFAULT;
		if(this[Action])
			this[Action]();
		this.Clear();
	},
	
	OpenTabs: function() {
		this.Selection.SelectedElements.forEach( function(elem) {
			if(elem.href)
				getBrowser().addTab(elem.href, this.DocumentReferer);
		} );
	},
	OpenWindows: function() {
		SnapLinks.Selection.SelectedElements.forEach( function(elem) {
			if(elem.href)
				window.open(elem.href);
		} );
	},
	OpenTabsInNewWindow: function() {
		if(SnapLinks.Selection.SelectedElements.length) {
			var urls = SnapLinks.Selection.SelectedElements.map( function(elem) {
				return elem.href;
			} ).join('|');

			return window.openDialog("chrome://browser/content/", "_blank", "all,chrome,dialog=no", urls);
		}
	},
	CopyToClipboard: function() {
		var Representations = SnapLinks.Selection.SelectedElements.reduce( function(acc, elem) {
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
				TextContent.data = Representations.text.join(' ');

				objData.addDataFlavor('text/unicode');
				objData.setTransferData('text/unicode', TextContent, TextContent.data.length * 2);	/* Double byte data (len*2) */
			}

			var HtmlContent = Components.classes["@mozilla.org/supports-string;1"]
								.createInstance(Components.interfaces.nsISupportsString);
			if(HtmlContent) {
				HtmlContent.data = Representations.html.join("\n");
				
				objData.addDataFlavor('text/html');
				objData.setTransferData('text/html', HtmlContent, HtmlContent.data.length * 2);	/* Double byte data (len*2) */
			}

			var objClipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
								.getService(Components.interfaces.nsIClipboard);
			if (objClipboard)
				objClipboard.setData(objData, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		}
	},
	BookmarkLinks: function() {
		if(SnapLinks.Selection.SelectedElements.length) {
			/* Does not work, find way to add bookmarks to FF4 - @BROKEN */
			var linksInfo = SnapLinks.Selection.SelectedElements.map( function(elem) {
				return { 
					name	: elem.textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' '),
					url		: elem.href,
				};
			} );
			const BROWSER_ADD_BM_FEATURES = 'centerscreen,chrome,dialog=no,resizable=yes';
			
			var dialogArgs = { name: gNavigatorBundle.getString("bookmarkAllTabsDefault") }
			dialogArgs.bBookmarkAllTabs = true;
			dialogArgs.objGroup = linksInfo;
			openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "", BROWSER_ADD_BM_FEATURES, dialogArgs);
		}
	},
	DownloadLinks: function() {
		if(SnapLinks.Selection.SelectedElements.length) {
			var TitlesUsed = { };
			
			var links = SnapLinks.Selection.SelectedElements.map( function(elem) {
				var Title = elem.textContent.replace(/\s{2,}/g, ' ').replace(/ /g,'_').replace(/[^a-zA-Z0-9_]+/g, '').substring(0, 75);
				
				/* Ensure Uniqueness of Filename */
				for(var j=0;j<99;j++) {
					var TitleCheck = Title;
					if(j > 0)
						TitleCheck += '' + j;
					if(TitlesUsed[TitleCheck] == undefined) {
						Title = TitleCheck
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
	},
}))();


