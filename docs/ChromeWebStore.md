# Chrome Web Store listing

The answers to give in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for the item `ikglmligndmabebhnicldebpekldnabm`. Edge Add-ons asks for the same in [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview). Keep this page in step with `src/templates/manifest.hbs`: a permission added there needs a justification here and in the dashboard, or review rejects the version.

## Package

Upload `snaplinks-vX.Y.Z-chrome.zip` from the GitHub Release. The store refuses a version that is not higher than the one it has.

## Store listing

| Field | Value |
|---|---|
| Name | Snap Links (from the manifest) |
| Summary | From the manifest `description` |
| Description | See below |
| Category | Productivity > Tools |
| Language | English |
| Screenshots (1280 x 800) | `res/Marketing/Screenshot1.png`, `res/Marketing/Screenshot2.png` |
| Store icon (128 x 128) | `res/SnapLinksLogo128.png` |
| Homepage URL | <https://cpriest.github.io/SnapLinksPlus> |
| Support URL | <https://github.com/cpriest/SnapLinksPlus/issues> |

Description:

```text
Hold the right mouse button and drag a rectangle over a page. Snap Links highlights the links, checkboxes, radio buttons and buttons inside it. Release the button to act on them:

* Open the links in new tabs, in a new window, or in one window each
* Copy the links to the clipboard, as URLs, with their titles, as Markdown or as HTML
* Bookmark the links in a new folder
* Check or uncheck the checkboxes, select a radio button, or click the buttons

Duplicate links are opened once. Hold SHIFT on release to reverse the order. The mouse button, modifier keys, actions, highlight colors and a list of sites where Snap Links is off are set on the options page.

Snap Links collects no data and makes no network requests.
Source code: https://github.com/cpriest/SnapLinksPlus
```

## Privacy practices

**Single purpose**

```text
Select many links, checkboxes, radio buttons or buttons on a page at once by dragging a rectangle with the mouse, then open, copy, bookmark, check or click them.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's options (mouse button, modifier keys, actions, highlight styles, disabled sites) with chrome.storage.sync. Keeps the order of the tabs it opened in chrome.storage.session, so tabs open in order after the service worker restarts. |
| `notifications` | Shows one notification after install or update. A click opens the tutorial or the list of changes on the project's site. |
| `clipboardWrite` | The "Copy links" action writes the URLs (and titles, if the user chose that format) of the selected links to the clipboard. |
| `offscreen` | The service worker has no clipboard. An offscreen document with the CLIPBOARD reason writes the copied links. It closes when the copy is done. |
| `bookmarks` (optional) | Requested only when the user chooses the "Bookmark links" action. Creates one folder with the selected links. |
| Host permission (content scripts on `<all_urls>`, all frames) | The user can drag a selection on any page, and in its frames. The content script draws the rectangle, finds the links and form elements inside it, and acts on them. It reads no page content other than the selected elements, and sends nothing off the device. |

**Remote code**: No, I am not using remote code. All JavaScript is in the package.

**Data usage**: check none of the data types. Check all three certifications (no sale of data, no use unrelated to the single purpose, no use for credit decisions).

**Privacy policy URL**: leave it empty. The store asks for one only when the item collects user data.

## Distribution

Public, all regions.
