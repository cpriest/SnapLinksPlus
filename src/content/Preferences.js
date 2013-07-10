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

var EXPORTED_SYMBOLS = ["SnapLinksPrefsClass"];

try {
	Components.utils.import("chrome://snaplinksplus/content/Utility.js");
}
catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

var SnapLinksPrefsClass = Class.create(PrefsMapper, {
	
	ShowCount_AddonBar	: 0,
	ShowCount_Hover		: 1,

	/* Checkbox Mixed State Action */
	CMSA_Uncheck	: 0,
	CMSA_Check		: 1,
	CMSA_Toggle		: 2,
	
	BasePath:	'extensions.snaplinks',
	map:	{
		SelectionButton:					{ Default: 2, 			OldName: '.button' },
		ActivateRequiresShift:				{ Default: false	},
		ActivateRequiresCtrl:				{ Default: false	},
		ActivateRequiresAlt:				{ Default: false	},
		
		SelectionBorderColor:				{ Default: '#30AF00', 	OldName: '.drawpicker' },
		SelectionBorderWidth:				{ Default: 3, 			OldName: '.drawthick' },
		SelectedElementsBorderColor:		{ Default: '#FF0000', 	OldName: '.linkspicker' },
		SelectedElementsBorderWidth:		{ Default: 1, 			OldName: '.linksthick' },

		SelectionStyle:						{ Default: {
													outline:			'3px dotted #30AF00',
													backgroundColor:	'rgba(255,0,0,50)'
												}
											},
		
		DefaultAction:						{ Default: 'OpenTabs',	OldName: '.defaultaction' },	/* @Broken */
		SwitchToFirstNewTab:				{ Default: true },
		ActionInterval:						{ Default: 200 },
		
		HighlightCheckboxesForClicking:		{ Default: true },
		HighlightButtonsForClicking:		{ Default: true },
		HighlightJsLinksForClicking:		{ Default: true },
		HideSelectionOnMouseLeave:			{ Default: false	},
		HighlightRadioButtonsForClicking:	{ Default: true },
		RemoveDuplicateUrls:				{ Default: true },
		AlwaysPromptDownloadName:			{ Default: false },
		ShowSelectedCount:					{ Default: true, 		OldName: '.shownumber' },
		ShowCountWhere:						{ Default: 1,			OldName: '.shownumber.where' },

		CheckboxMixedStateAction:			{ Default: 0,			OldName: '.checkbox_mixedstate' },

		CopyToClipboardSeparatorId:			{ Default: 1,			Name: '.CopyToClipboardSeparator.Id' },
		CopyToClipboardSeparatorCustom:		{ Default: ',',			Name: '.CopyToClipboardSeparator.Custom' },

		Events_MouseDown_FireEventOnLinks:	{ Default: false,		Name: '.Events.MouseDown.FireEventsOnLinks' },
		Events_MouseUp_FireEventOnLinks:	{ Default: false,		Name: '.Events.MouseUp.FireEventsOnLinks' },

		DevMode:							{ Default: false},
		DevShowJSConsoleAtStartup:			{ Default: false	}
	},

	initialize: function($super) {
		$super(this.BasePath, this.map);

		/* Translate from older format */
		if(this.PrefsBranch.getPrefType(this.map.DefaultAction.SubPath) == this.PrefsBranch.PREF_INT)
			this.TranslatePropertyPrefValue('DefaultAction', {	0:'OpenTabs', 1:'OpenWindows', 2:'OpenTabsInNewWindow', 3:'CopyToClipboard', 4:'BookmarkLinks', 5:'DownloadLinks' });
	}
});
