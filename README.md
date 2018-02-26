
# [Snap Links Plus](https://cpriest.github.io/SnapLinksPlus/)

<div style="float: right; width: 250px; position: relative; background: #FAFAFA; z-index: 10; padding-left: 10px;"><div style="padding: 15px 15px; background: #FAFAFA; border: 1px solid #C0C0C0; border-radius: 5px; filter: drop-shadow(3px 3px 3px #555);">

**Quick Links**

  * [Help & Documentation](https://cpriest.github.io/SnapLinksPlus/welcome.html)
  * [Release Notes](ReleaseNotes.md)
  * Reporting Issues
  * Contributing

</div></div>

## News

* 2018-02-28 - New Release: ![Firefox][FF16] [3.1.2b1]() ![Chrome][CH16] [3.1.2.1]()
*

New Website Online: [Snap Links v3](http://cpriest.github.io/SnapLinksPlus/)

Latest Release: v3.1.0.4, available at [Mozilla Addons](https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/)

Latest Beta (unsigned, **testers welcomed**): See [dist directory](https://github.com/cpriest/SnapLinksPlus/tree/master/dist)

Snap Links Plus is being re-written from the ground up to be a [Web Extension](https://developer.mozilla.org/en-US/Add-ons/WebExtensions).

The reasons behind this are simple, [electrolysis](https://wiki.mozilla.org/Electrolysis) is coming, [XUL/XPCOM are on the way out and chrome style plugins are the new standard](https://blog.mozilla.org/addons/2015/08/21/the-future-of-developing-firefox-add-ons/), which also happens to be both restartless and compatible with chrome, opera and in the future, other browsers.

Personally I have put off fixing Snap Links Plus because I have not had the time, nor desire to bite off the large project.  With v3 we are starting anew with no legacy code.  This means some features may no longer exist while other new features are written.

I wholly encourage forking this project and submitting code and patches for inclusion.

**It is doubtful that all v2 features will be rewritten for v3 without the help of others**.

Please see [Dev Notes](DevNotes.md) for the latest development status.


## Known Issues & Some Planned Features
 * Add Options GUI
 * Open in New Tabs/New Windows/Tabs In New Window


## HTML Rendering Examples from https://github.github.com/gfm/#html-block

<DIV CLASS="foo">

*Markdown class foo*

</DIV>

<del>
*foo*
</del>

<div><input type="button" value="Test Button"><label><input type="checkbox" value="1"> Test Checkbox</label>

** Test Markdown **

</div>

<div>
<input type="button" value="Test Button">
<label>
<input type="checkbox" value="1">Test Checkbox</label>

** Test Markdown 2 **

</div>

<div>
<button title="title" value="do">my button</button>
<input type="button" value="Test Button">
<label>
<input type="checkbox" value="1">Test Checkbox</label>
** Test Markdown 3 **
</div>

<div> <input type="button" value="Test Button"> <label> <input type="checkbox" value="1">Test Checkbox</label> ** Test Markdown 3 ** </div>

<!-- @formatter:off -->

<div> <input type="button" value="Test Button"> <label> <input type="checkbox" value="1">Test Checkbox</label> ** Test Markdown 3 ** </div>

<!-- @formatter:on -->

<form><div> <input type="button" value="Test Button"> <label> <input type="checkbox" value="1">Test Checkbox</label> ** Test Markdown 3 ** </div></form>


<?php echo 'dodad'; ?>

<table>

<tr>

<td>
Hi
</td>

</tr>

</table>

----

[Snap Links Plus](https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/) is a Firefox addon that lets you draw a lasso around links, checkboxes and other on-screen elements and open them in new tabs as  well as other actions:

* Open in New Tabs
* Open in New Windows
* Open Tabs in New Window
* Bookmark All
* Download All
* Copy to Clipboard

# Installing
To install the addon, click on one of the links for your browser on the [home page](https://cpriest.github.io/SnapLinksPlus/).

[FF16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/firefox/firefox_16x16.png
[CH16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/chrome/chrome_16x16.png
