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


SnapLinks.Prefs = new (Class.create(PrefsMapper, {
	BasePath:	'extensions.snaplinks',
	map:	{
		DevShowJSConsoleAtStartup:			{ Type: 'bool', Default: false, 		},
		DefaultAction:						{ Type: 'char', Default: 'OpenTabs', 	Name: '.defaultaction' },	/* @Broken */
		SelectionButton:					{ Type: 'int', 	Default: 2, 			Name: '.button' },
		ActivateRequiresAlt:				{ Type: 'bool', Default: false,			},
		ActivateRequiresShift:				{ Type: 'bool', Default: false,			},
		ActivateRequiresCtrl:				{ Type: 'bool', Default: false,			},
		HideSelectionOnMouseLeave:			{ Type: 'bool',	Default: false },
		ShowSelectedCount:					{ Type: 'bool', Default: true, 			Name: '.shownumber' },
		SelectedElementsBorderWidth:		{ Type: 'int', 	Default: 1, 			Name: '.linksthick' },
		SelectionBorderWidth:				{ Type: 'int', 	Default: 3, 			Name: '.drawthick' },
		SelectionBorderColor:				{ Type: 'char', Default: '#30AF00', 	Name: '.drawpicker' },
		SelectedElementsBorderColor:		{ Type: 'char', Default: '#FF0000', 	Name: '.linkspicker' },
		
		HighlightCheckboxesForClicking:		{ Type: 'bool', Default: true },
		HighlightButtonsForClicking:		{ Type: 'bool', Default: true },
		RemoveDuplicateUrls:				{ Type: 'bool', Default: true },
	},
	initialize: function($super) {
		$super(this.BasePath, this.map);

		/* Translate from older format */
		if(this.pref.getPrefType(this.map.DefaultAction.Path) == this.pref.PREF_INT)
			this.TranslatePref('DefaultAction', {	0:'OpenTabs', 1:'OpenWindows', 2:'OpenTabsInNewWindow', 3:'CopyToClipboard', 4:'BookmarkLinks', 5:'DownloadLinks' });
	},
}))();
