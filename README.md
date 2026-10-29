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

### Local files (file:// pages)
Firefox does not let add-ons run on local files until you allow it for each add-on. To use Snap Links on `file://` pages:

1. Open `about:addons` and select **Snap Links**.
2. Open the **Permissions** tab.
3. Turn on **Access local files on your computer**.
4. Reload any local page that is already open.

### GNU/Linux and macOS
On Linux and macOS, Firefox opens the context menu when you press the right mouse button, not when you release it. This stopped right-button drags ([#400](https://github.com/cpriest/SnapLinksPlus/issues/400)).

Snap Links now fixes this itself. While the right mouse button starts a selection, Snap Links tells Firefox to open the context menu when you release the button. A right-click without a drag still shows the context menu. If you change Snap Links to another mouse button, Firefox goes back to its normal behavior.

If the context menu still opens when you start a drag, another add-on or a policy may control this Firefox setting. Then set `ui.context_menus.after_mouseup` to `true` in `about:config`.
