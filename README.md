# Snap Links Plus

Snap Links is a browser add-on that lets you lasso links, checkboxes, and other elements and do things with them.

**See our [website](https://cpriest.github.io/SnapLinksPlus/) for news, tutorials, release notes, etc.**

**Quick Tutorial:** Once installed, lasso elements on a page using the default action: hold the right mouse button, drag the cursor over them, and release to click them (opening links, toggling checkboxes, etc.).

Example when links are lassoed:

<img width="700" height="438" alt="image" src="https://github.com/user-attachments/assets/2c193e84-4ba0-4b93-b69c-7f42f9abeb2c" />

Example when checkboxes and radio buttons are lassoed:

<img width="533" height="161" alt="image" src="https://github.com/user-attachments/assets/5c155006-c291-49f3-aff0-1c8ca0f7ad61" />

## Comparison with Linkclump

| Feature | Snap Links Plus | Linkclump |
| :--- | :---: | :---: |
| **License** | [MIT License](https://www.google.com/search?q=https://github.com/cpriest/SnapLinksPlus/blob/master/LICENSE) | [MIT License](https://www.google.com/search?q=https://github.com/benranya/Linkclump/blob/master/LICENSE) |
| **Default Trigger** | Right-click + Drag | `Z` + Left-click + Drag |
| **Lasso Links** | Yes | Yes |
| **Lasso Checkboxes & Radio Buttons** | **Yes** | No |
| **Open in New Tabs** | Yes | Yes |
| **Open in New Windows** | Planned ([#576](https://github.com/cpriest/SnapLinksPlus/issues/576)) | Yes |
| **Open Tabs in New Window** | Planned ([#182](https://github.com/cpriest/SnapLinksPlus/issues/182)) | Yes |
| **Copy URLs to Clipboard** | Yes | Yes |
| **Bookmark Selected Links** | Planned ([#216](https://github.com/cpriest/SnapLinksPlus/issues/216)) | Yes |

## Contributors Needed

I'm happy to review [pull requests](https://github.com/cpriest/SnapLinksPlus/pulls), but I can't spend much time on the project; any help you can provide would be greatly appreciated. I'm also willing to help you set up your local development environment if needed.

I'm looking for people to help triage [new issues](https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc), [label](https://github.com/cpriest/SnapLinksPlus/labels) them, answer feature-related ones, and confirm bug reports. It would be a **huge help** to the project. I had time recently to work on the project and found myself spending time going through tickets instead.

If you're interested, please reach out by [opening a ticket](https://github.com/cpriest/SnapLinksPlus/issues/new).

Thanks!

### GNU/Linux
On Firefox-based browsers for GNU/Linux, Snap Links Plus is affected by a long-standing issue where [right click pulls context menu before snap drag](https://github.com/cpriest/SnapLinksPlus/issues/400), blocking links from being selected. Given the lack of recent activity on the underlying Firefox bugs ([bug 1443482](https://bugzilla.mozilla.org/show_bug.cgi?id=1443482) and [bug 1448442](https://bugzilla.mozilla.org/show_bug.cgi?id=1448442)), bringing fresh attention to them on Bugzilla can help prioritize a fix.

Meanwhile, [Linkclump for Firefox](https://addons.mozilla.org/en-US/firefox/addon/linkclump-for-firefox/) is a solid alternative for link management. By default, hold the Z key, hold the left mouse button, and drag the cursor over links, then release the button to open them in new tabs.
