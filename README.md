# Snap Links Plus

Snap Links is a browser add-on that lets you lasso links, checkboxes, and other elements and do things with them.

**Quick Tutorial:** Once installed, lasso elements on a page by holding the right mouse button and dragging the cursor over them, then release the button to click them (opening links, toggling checkboxes, etc.).

Example when links are lassoed:

<img width="700" height="438" alt="image" src="https://github.com/user-attachments/assets/2c193e84-4ba0-4b93-b69c-7f42f9abeb2c" />

Example when checkboxes and radio buttons are lassoed:

<img width="533" height="161" alt="image" src="https://github.com/user-attachments/assets/5c155006-c291-49f3-aff0-1c8ca0f7ad61" />


**See our [website](https://cpriest.github.io/SnapLinksPlus/) for news, tutorials, release notes, etc.**

## Contributors Needed

I'm happy to review [pull requests](https://github.com/cpriest/SnapLinksPlus/pulls), but I can't spend much time on the project; any help you can provide would be greatly appreciated. I'm also willing to help you set up your local development environment if needed.

I'm looking for people to help triage [new issues](https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc), [label](https://github.com/cpriest/SnapLinksPlus/labels) them, answer feature-related ones, and confirm bug reports. It would be a **huge help** to the project. I had time recently to work on the project and found myself spending time going through tickets instead.

If you're interested, please reach out by [opening a ticket](https://github.com/cpriest/SnapLinksPlus/issues/new).

Thanks!

### GNU/Linux and macOS

While selection uses the right mouse button, Snap Links Plus uses Firefox's `browserSettings` permission to make context menus open when the mouse button is released. This prevents the [context menu from opening over a selection drag (#400)](https://github.com/cpriest/SnapLinksPlus/issues/400). No manual `about:config` change is needed. Windows already opens context menus on release.

**This changes global context menu behavior throughout Firefox**, including ordinary right-clicks outside Snap Links selections. On GNU/Linux and macOS, menus will open on button release instead of button press.

Selecting another activation button in Snap Links options releases the extension's control of this setting. Firefox also releases that control when the extension is disabled or uninstalled, restoring the underlying user preference or another extension's setting. A browser policy or another extension controlling the setting may prevent this fix from taking effect.