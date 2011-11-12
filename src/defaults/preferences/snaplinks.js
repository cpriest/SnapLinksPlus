/*
 *  defaults/preferences/snaplinks.js
 *  
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Tommi Rautava
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

pref('extensions.snaplinks@snaplinks.mozdev.org.description',   'chrome://snaplinksplus/locale/snaplinks.properties');  

pref('extensions.snaplinks.button',                             2);
pref('extensions.snaplinks.ActivateRequiresShift',              false);
pref('extensions.snaplinks.ActivateRequiresCtrl',               false);
pref('extensions.snaplinks.ActivateRequiresAlt',                false);

pref('extensions.snaplinks.drawpicker',                         '#30AF00');
pref('extensions.snaplinks.drawthick',                          3);
pref('extensions.snaplinks.linkspicker',                        '#FF0000');
pref('extensions.snaplinks.linksthick',                         1);

pref('extensions.snaplinks.defaultaction',                      'OpenTabs');
pref('extensions.snaplinks.ActionInterval',                     200);

pref('extensions.snaplinks.HighlightCheckboxesForClicking',     true);
pref('extensions.snaplinks.HighlightButtonsForClicking',        true);
pref('extensions.snaplinks.HighlightJsLinksForClicking',        true);
pref('extensions.snaplinks.HideSelectionOnMouseLeave',          false);
pref('extensions.snaplinks.RemoveDuplicateUrls',                true);
pref('extensions.snaplinks.AlwaysPromptDownloadName',           false);
pref('extensions.snaplinks.shownumber',                         true);
pref('extensions.snaplinks.shownumber.where',                   1);

pref('extensions.snaplinks.CopyToClipboardSeparator.Id',        1);
pref('extensions.snaplinks.CopyToClipboardSeparator.Custom',    ',');
