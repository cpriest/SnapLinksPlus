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

  * *A clear title and description*.
  * A *publicly accessible link* and instructions on reproducing the issue.
  * If possible *a screenshot or quick video* demonstrating the issue.
  * Any other *relevant details* that you can think of.


&nbsp;
## Suggesting Enhancements
__Ensure the feature is not already requested__ by searching on Github under [Issues][Issues-Enh].

If you're unable to find an open issue relating to the feature, [open a new one][Issues-New].


&nbsp;
## Your First Code Contribution

### Local Environment
You'll need to setup the project locally and install a few tools to build Snap Links for yourself.

1. Start by ![Forking][ForkIcon] [Forking][ForkRepo] Snap Links to your own area on github.
2. Install [git](https://git-scm.com/downloads) and [node.js](https://nodejs.org/en/download/) on your machine.
3. Clone your fork locally from a command line, something like:
    ```bash
    # Change directory to where you want to clone it
    cd c:\code

    # Clone the repository to your local machine
    git clone {your repo}
    ```
4.  Setup node by running the following:

    ```bash
    # Install the gulp tool globally on your machine
    npm install -g gulp

    # Install the node packages for SnapLinks (these will go into node_modules/)
    npm install
    ```
5. Finally, run `gulp` to build the Chrome and FireFox builds.
    You may also use `gulp watch` to build updated versions as you modify files.

By default, gulp will build the web extension in your project directory under build/chrome and build/ff.

### Loading the extension

**Firefox**

You'll need to be using Firefox Developer edition or newer, there are a number of methods for loading the extension into firefox.

The way I prefer to use is with a proxy file.  Find the extension directory for your profile (on Windows, typically %APPDATA%\Mozilla\Firefox\Profiles\...\extensions).  Create a text file there named `snaplinks@snaplinks.mozdev.org` and in that file should be the path to your firefox build (`C:\code\WebExt\SnapLinks3\build\ff` on my machine).

**Note:** It's a good idea to keep a copy of that file elsewhere, sometimes FireFox will delete it under some conditions, especially when first being put in place.  Once you put that file in place start (or restart) FireFox and go to your addons and enable the extension.  If it is not showing, then it probably deleted that proxy file; in that case close FireFox and try again.

**Chrome**
Go to your extensions page, at the top right, check the box labeled `Developer Mode`, then click the button labeled `Load unpacked extension`and select the build\chrome directory.  You'll need to keep `Developer Mode` active for the extension to continue functioning.

### Getting Developer Help

If you have any questions or trouble getting things up and running, please feel free to join the [gitter channel][Gitter-Lobby], I'd be happy to help.

&nbsp;
## Pull Requests

  * Open a new Github pull request with the patch.
  * Ensure the PR description links to the [open issue][Issues-Open] and clearly describes the solution.






[MozBeta]: https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/
[MozRelease]: https://addons.mozilla.org/en-US/firefox/addon/snaplinksplus/
[ChromeRelease]: #
[FF16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/firefox/firefox_16x16.png
[CH16]: https://cdnjs.cloudflare.com/ajax/libs/browser-logos/45.3.0/chrome/chrome_16x16.png
[IntroPage]: http://cpriest.github.io/SnapLinksPlus/welcome
[Gitter-Lobby]: https://gitter.im/SnapLinks/Lobby
[Issues-Open]: https://github.com/cpriest/SnapLinksPlus/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc
[Issues-Bugs]: https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Abug
[Issues-Enh]: https://github.com/cpriest/SnapLinksPlus/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3Aenhancement
[Issues-New]: https://github.com/cpriest/SnapLinksPlus/issues/new
[ForkIcon]: https://cdnjs.cloudflare.com/ajax/libs/octicons/4.4.0/svg/repo-forked.svg
[ForkRepo]: https://github.com/cpriest/SnapLinksPlus#fork-destination-box
