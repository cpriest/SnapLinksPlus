/*
 *  defaults/preferences/snaplinks.js
 *  
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2008  Tommi Rautava
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

pref('extensions.snaplinks@snaplinks.mozdev.org.description', 'chrome://snaplinks/locale/snaplinks.properties');  

pref('extensions.snaplinks.button', 2);
pref('extensions.snaplinks.defaultaction', 'OpenTabs');
pref('extensions.snaplinks.HideSelectionOnMouseLeave', false);
pref('extensions.snaplinks.shownumber', true);
pref('extensions.snaplinks.shownumber.where', 'Hover');

pref('extensions.snaplinks.linkspicker','#FF0000');
pref('extensions.snaplinks.linksthick',1);
pref('extensions.snaplinks.drawpicker','#30AF00');
pref('extensions.snaplinks.drawthick',3);

pref('extensions.snaplinks.HighlightButtonsForClicking', true);
pref('extensions.snaplinks.HighlightCheckboxesForClicking', true);

pref('extensions.snaplinks.ActivateRequiresAlt', false);
pref('extensions.snaplinks.ActivateRequiresShift', false);
pref('extensions.snaplinks.ActivateRequiresCtrl', false);
pref('extensions.snaplinks.RemoveDuplicateUrls', true);

pref('extensions.snaplinks.CopyToClipboardSeparator', "\n");