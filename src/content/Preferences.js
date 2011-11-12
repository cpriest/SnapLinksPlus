/*
 *  Preferences.js
 *
 *  Copyright (C) 2011  Clint Priest, Tommi Rautava
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


SnapLinks.Prefs = new (Class.create(PrefsMapper, {
	
	ShowCount_AddonBar	: 0,
	ShowCount_Hover		: 1,
	
	BasePath:	'extensions.snaplinks',
	map:	{
		SelectionButton:					{ Type: 'int', 	Default: 2, 			Name: '.button' },
		ActivateRequiresShift:				{ Type: 'bool',	Default: false	},
		ActivateRequiresCtrl:				{ Type: 'bool',	Default: false	},
		ActivateRequiresAlt:				{ Type: 'bool',	Default: false	},
		
		SelectionBorderColor:				{ Type: 'char',	Default: '#30AF00', 	Name: '.drawpicker' },
		SelectionBorderWidth:				{ Type: 'int', 	Default: 3, 			Name: '.drawthick' },
		SelectedElementsBorderColor:		{ Type: 'char',	Default: '#FF0000', 	Name: '.linkspicker' },
		SelectedElementsBorderWidth:		{ Type: 'int', 	Default: 1, 			Name: '.linksthick' },
		
		DefaultAction:						{ Type: 'char',	Default: 'OpenTabs',	Name: '.defaultaction' },	/* @Broken */
		ActionInterval:						{ Type: 'int',	Default: 200 },
		
		HighlightCheckboxesForClicking:		{ Type: 'bool',	Default: true },
		HighlightButtonsForClicking:		{ Type: 'bool',	Default: true },
		HighlightJsLinksForClicking:		{ Type: 'bool',	Default: true },
		HideSelectionOnMouseLeave:			{ Type: 'bool',	Default: false	},
		RemoveDuplicateUrls:				{ Type: 'bool',	Default: true },
		AlwaysPromptDownloadName:			{ Type: 'bool',	Default: false },
		ShowSelectedCount:					{ Type: 'bool',	Default: true, 			Name: '.shownumber' },
		ShowCountWhere:						{ Type: 'int', 	Default: 1,				Name: '.shownumber.where' },
		
		CopyToClipboardSeparatorId:			{ Type: 'int',	Default: 1,				Name: '.CopyToClipboardSeparator.Id' },
		CopyToClipboardSeparatorCustom:		{ Type: 'char',	Default: ',',			Name: '.CopyToClipboardSeparator.Custom' },
		
		DevShowJSConsoleAtStartup:			{ Type: 'bool',	Default: false	}
	},
	
	initialize: function($super) {
		$super(this.BasePath, this.map);

		/* Translate from older format */
		if(this.pref.getPrefType(this.map.DefaultAction.Path) == this.pref.PREF_INT)
			this.TranslatePref('DefaultAction', {	0:'OpenTabs', 1:'OpenWindows', 2:'OpenTabsInNewWindow', 3:'CopyToClipboard', 4:'BookmarkLinks', 5:'DownloadLinks' });
	}
}))();
