## Contributing to Snap Links

:clap: First, thanks for taking the time to contribute! :clap:

**Table of Contents**

[Getting Help](README.md#getting-help)

### How Can I Contribute?
  * [Reporting Bugs](#reporting-bugs)
  * [Suggesting Enhancements](#suggesting-enhancements)
  * [Your First Code Contribution](#your-first-code-contribution)
    * [Local Dev Environment](#local-environment)
    * [Loading The Extension](#loading-the-extension)
    * [Getting Developer Help](#getting-developer-help)
  * [Pull Requests](#pull-requests)

Snap Links is a volunteer effort.  We encourage you to pitch in and help however you can!

&nbsp;
## Reporting Bugs
__Ensure the bug is not already reported__ by searching on Github under [Issues][Issues-Bugs].

If you're unable to find an open issue addressing the problem, [open a new one][Issues-New].

__Be sure to include__:

  * *__A clear title and description__*.
  * A __publicly accessible link__ and instructions on reproducing the issue.
  * If possible *a screenshot or quick video* demonstrating the issue.
  * Any other *relevant details* that you can think of.


&nbsp;
## Suggesting Enhancements
__Ensure the feature is not already requested__ by searching on Github under [Issues][Issues-Enh].

If you're unable to find an open issue relating to the feature, [open a new one][Issues-New].


&nbsp;
## **Your First Code Contribution**
Mozilla authors and maintains fabulous documentation and tutorials at Mozilla Developer Network (MDN).  A great first read for web extensions is [Anatomy of an extension][MDN-Ext-Anatomy]

### Local Environment
You'll need to setup the project locally and install a few tools to build Snap Links for yourself.

1. Start by ![Forking][ForkIcon] [Forking][ForkRepo] Snap Links to your own area on github.
2. Install [git](https://git-scm.com/downloads) and [node.js](https://nodejs.org/en/download/) on your machine.
3. Clone your fork locally from a command line, something like:
    ```shell
    # Change directory to where you want to clone it
    cd c:\code

    # Clone the repository to your local machine
    git clone {your repo}
    ```
4.  Setup node by running the following:

    ```shell
    # Install the gulp tool globally on your machine
    npm install -g gulp

    # Install the node packages for SnapLinks (these will go into node_modules/)
    npm install
    ```
5. Finally, run <kbd>gulp</kbd> to build the Chrome and FireFox builds.  
    \* You may also use <kbd>gulp watch</kbd> to build updated versions as you modify files.

By default, gulp will build the web extension in your project directory under build/chrome and build/ff.

### Loading the extension

**Firefox**

You'll need to be using [Firefox Developer][FF-DevEd] edition, and set your *xpinstall.signatures.required* to false in *about:config*.

There are a number of methods for loading the extension into firefox, I prefer to use is with a *proxy file*.

Find the extension directory for your profile (on Windows, typically `%APPDATA%\Mozilla\Firefox\Profiles\...\extensions`).  Create a text file there named `snaplinks@snaplinks.mozdev.org` and in that file should be the path to your firefox build (`C:\code\WebExt\SnapLinks3\build\ff` on my machine).

**Note:** It's a good idea to keep a copy of that file elsewhere, sometimes FireFox will delete it under some conditions, especially when first being put in place.  Once you put that file in place start (or restart) FireFox and go to your addons and enable the extension.  If it is not showing, then it probably deleted that proxy file; in that case close FireFox and try again.

**Chrome**

Go to your extensions page, at the top right, check the box labeled **Developer Mode**, then click the button labeled **Load unpacked extension**and select the build\chrome directory.

You'll need to keep Developer Mode active for the extension to continue functioning.

## Getting Developer Help

If you have any questions or trouble getting things up and running, please feel free to join the [gitter channel][Gitter-Lobby], I'd be happy to help.

&nbsp;
## Pull Requests

  * Open a new Github pull request with the patch.
  * Ensure the PR description links to the [open issue][Issues-Open] and clearly describes the solution.












[MozBeta]: https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/versions/beta
[MozRelease]: https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/
[ChromeBeta]: https://chrome.google.com/webstore/detail/snap-links-beta/ikglmligndmabebhnicldebpekldnabm?authuser=1
[ChromeRelease]: #
[FF16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/firefox/firefox_16x16.png
[FF48]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/firefox/firefox_48x48.png
[CH16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/chrome/chrome_16x16.png
[CH48]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/chrome/chrome_48x48.png
[IntroPage]: http://cpriest.github.io/SnapLinksPlus/welcome
[Gitter-Lobby]: https://gitter.im/SnapLinks/Lobby
[Issues-Open]: https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+sort%3Acomments-desc
[Issues-Bugs]: https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+label%3Abug+sort%3Acomments-desc
[Issues-Enh]: https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement+sort%3Areactions-%2B1-desc
[Milestones]: https://github.com/cpriest/SnapLinksPlus/milestones?direction=desc&sort=completeness&state=open
[Issues-New]: https://github.com/cpriest/SnapLinksPlus/issues/new
[ForkIcon]: https://cdnjs.cloudflare.com/ajax/libs/octicons/4.4.0/svg/repo-forked.svg
[ForkRepo]: https://github.com/cpriest/SnapLinksPlus#fork-destination-box


[MDN-Ext-Anatomy]: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Anatomy_of_a_WebExtension
[FF-DevEd]: https://www.mozilla.org/firefox/developer/
