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

var EXPORTED_SYMBOLS = ["SnapLinksPrefsClass",'SLPrefs'];

try {
	Components.utils.import("chrome://snaplinksplus/content/Utility.js");
	Components.utils.import("chrome://snaplinksplus/content/WindowFaker.js");
}
catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

var SLPrefs = CreatePreferenceMap('extensions.snaplinks', {

	Activation: {
		RequiresShift:	false,
		RequiresCtrl:	false,
		RequiresAlt:	false,
	},

	Selection:	{
		Button: 			2,
		HideOnMouseLeave:	false,
		BorderColor:		'#30AF00',
		BorderWidth:		3,
//		Style: {
//			outline: 			'3px dotted #30AF00',
//			backgroundColor:	'rgba(255,0,0,50)',
//		},
//		ShowCount:	0,		/* 0: Don't show, 1: Hover Panel, 2: AddonBar */
		ShowCount:			true,
		ShowCountWhere:		1,
	},

	SelectedElements: {
		BorderColor: '#FF0000',
		BorderWidth: 1,
//		Style: {
//			outline:	'1px solid #FF0000',
//		},
	},

	Elements: {
		Anchors: {
			Highlight:				true,
			RemoveDuplicateUrls:	true,
		},
		Checkboxes: {
			Highlight:				true,
			MixedStateAction:		0,
		},
		Buttons: {
			Highlight:	true,
		},
		JSLinks: {
			Highlight:	true,
		},
		RadioButtons: {
			Highlight:	true,
		},
	},

	Actions: {
		Default:					'OpenTabs',
		DelayBetweenActions:		200,

		OpenTabs: {
			SwitchToFirstNewTab:	true,
		},
		CopyToClipboard: {
			SeparatorId:	1,
			Separator:		',',
		},
		Download: {
			PromptForName:	false,
		},
	},

	Special: {
		FireEventsOnLinks: {
			MouseDown:		false,
			MouseUp:		false,
		},
	},

	Dev: {
		Mode:					false,
		ShowConsoleAtStartup:	false,
	},
});

UpdatePreferences('extensions.snaplinks',  {
//	'SelectionButton': 						'Selection.Button',
//	'ActivateRequiresShift': 				'Activation.RequiresShift',
//	'ActivateRequiresCtrl': 				'Activation.RequiresCtrl',
//	'ActivateRequiresAlt': 					'Activation.RequiresAlt',
//
//	'SelectionBorderColor':					'Selection.BorderColor',
//	'SelectionBorderWidth':					'Selection.BorderWidth',
//	'SelectedElementsBorderColor':			'SelectedElements.BorderColor',
//	'SelectedElementsBorderWidth':			'SelectedElements.BorderWidth',
//
//	'DefaultAction':	 {
//		MoveTo:		'Actions.Default',
//		Translate:  { 0:'OpenTabs', 1:'OpenWindows', 2:'OpenTabsInNewWindow', 3:'CopyToClipboard', 4:'BookmarkLinks', 5:'DownloadLinks' }
//	},
//	'SwitchToFirstNewTab':					'Actions.OpenTabs.SwitchToFirstNewTab',
//	'ActionInterval':						'Actions.DelayBetweenActions',
//
//	'HighlightCheckboxesForClicking':		'Elements.Checkboxes.Highlight',
//	'HighlightButtonsForClicking':			'Elements.Buttons.Highlight',
//	'HighlightJsLinksForClicking':			'Elements.JSLinks.Highlight',
//	'HighlightRadioButtonsForClicking':		'Elements.RadioButtons.Highlight',
//	'HideSelectionOnMouseLeave':			'Selection.HideOnMouseLeave',
//	'RemoveDuplicateUrls':					'Elements.Anchors.RemoveDuplicateUrls',
//	'AlwaysPromptDownloadName':				'Actions.Download.PromptForName',
//	'ShowSelectedCount':					'Selection.ShowCount',
//	'ShowCountWhere':						'Selection.ShowCountWhere',
//
//	'CheckboxMixedStateAction':				'Elements.Checkboxes.MixedStateAction',
//
//	'CopyToClipboardSeparatorId':			'Actions.CopyToClipboard.SeparatorId',
//	'CopyToClipboardSeparatorCustom':		'Actions.CopyToClipboard.Separator',
//
//	'Events.MouseDown.FireEventsOnLinks': 	'Special.FireEventsOnLinks.MouseDown',
//	'Events.MouseUp.FireEventsOnLinks': 	'Special.FireEventsOnLinks.MouseUp',

	'DevMode':								'Dev.Mode',
	'DevShowJSConsoleAtStartup':			'Dev.ShowConsoleAtStartup',
});

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

		DefaultAction:						{ Default: 'OpenTabs',	OldName: '.defaultaction' },	/* @Broken */
		SwitchToFirstNewTab:				{ Default: true },
		ActionInterval:						{ Default: 200 },
		
		HighlightCheckboxesForClicking:		{ Default: true },
		HighlightButtonsForClicking:		{ Default: true },
		HighlightJsLinksForClicking:		{ Default: true },
		HideSelectionOnMouseLeave:			{ Default: false },
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
