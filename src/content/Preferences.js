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

var EXPORTED_SYMBOLS = ['SLPrefs', 'SLE'];

try {
	Components.utils.import("chrome://snaplinksplus/content/Utility.js");
	Components.utils.import("chrome://snaplinksplus/content/WindowFaker.js");
}
catch(e) {
	Components.utils.reportError(e + ":\n"+ e.stack);
}

/* Snap Links Enums */
var SLE = {
	/* Selection.ShowCountWhere */
	ShowCount_AddonBar	: 0,
	ShowCount_Hover		: 1,

	/* Elements.Checkboxes.MixedStateAction */
	CMSA_Uncheck	: 0,
	CMSA_Check		: 1,
	CMSA_Toggle		: 2,
};

var SLPrefs = CreatePreferenceMap('extensions.snaplinks', {

	Activation: {
		Button: 		2,
		RequiresShift:	false,
		RequiresCtrl:	false,
		RequiresAlt:	false,
	},

	Selection:	{
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
			Highlight:				true,		/* Unused */
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
		ClearConsoleDelay:		1000,
	},
});

UpdatePreferences('extensions.snaplinks',  {
	'SelectionButton': 						'Activation.Button',
	'button': 								'Activation.Button',
	'ActivateRequiresShift': 				'Activation.RequiresShift',
	'ActivateRequiresCtrl': 				'Activation.RequiresCtrl',
	'ActivateRequiresAlt': 					'Activation.RequiresAlt',

	'SelectionBorderColor':					'Selection.BorderColor',
	'drawpicker':							'Selection.BorderColor',
	'SelectionBorderWidth':					'Selection.BorderWidth',
	'drawthick':							'Selection.BorderWidth',
	'SelectedElementsBorderColor':			'SelectedElements.BorderColor',
	'linkspicker':							'SelectedElements.BorderColor',
	'SelectedElementsBorderWidth':			'SelectedElements.BorderWidth',
	'linksthick':							'SelectedElements.BorderWidth',

	'defaultaction':						'DefaultAction',
	'DefaultAction':	 {
		MoveTo:		'Actions.Default',
		Translate:  { 0:'OpenTabs', 1:'OpenWindows', 2:'OpenTabsInNewWindow', 3:'CopyToClipboard', 4:'BookmarkLinks', 5:'DownloadLinks' }
	},
	'SwitchToFirstNewTab':					'Actions.OpenTabs.SwitchToFirstNewTab',
	'ActionInterval':						'Actions.DelayBetweenActions',

	'HighlightCheckboxesForClicking':		'Elements.Checkboxes.Highlight',
	'HighlightButtonsForClicking':			'Elements.Buttons.Highlight',
	'HighlightJsLinksForClicking':			'Elements.JSLinks.Highlight',
	'HighlightRadioButtonsForClicking':		'Elements.RadioButtons.Highlight',
	'HideSelectionOnMouseLeave':			'Selection.HideOnMouseLeave',
	'RemoveDuplicateUrls':					'Elements.Anchors.RemoveDuplicateUrls',
	'AlwaysPromptDownloadName':				'Actions.Download.PromptForName',
	'ShowSelectedCount':					'Selection.ShowCount',
	'shownumber':							'Selection.ShowCount',
	'ShowCountWhere':						'Selection.ShowCountWhere',
	'shownumber.where':						'Selection.ShowCountWhere',

	'CheckboxMixedStateAction':				'Elements.Checkboxes.MixedStateAction',
	'checkbox_mixedstate':					'Elements.Checkboxes.MixedStateAction',

	'CopyToClipboardSeparator.Id':			'Actions.CopyToClipboard.SeparatorId',
	'CopyToClipboardSeparator.Custom':		'Actions.CopyToClipboard.Separator',

	'Events.MouseDown.FireEventsOnLinks': 	'Special.FireEventsOnLinks.MouseDown',
	'Events.MouseUp.FireEventsOnLinks': 	'Special.FireEventsOnLinks.MouseUp',

	'DevMode':								'Dev.Mode',
	'DevShowJSConsoleAtStartup':			'Dev.ShowConsoleAtStartup',
});
