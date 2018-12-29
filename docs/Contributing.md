## Contributing to Snap Links

:clap: First, thanks for taking the time to contribute! :clap:

### How Can I Contribute?
  * [Reporting Bugs](#reporting-bugs)
  * [Suggesting Enhancements](#suggesting-enhancements)
  * [Your First Code Contribution](#your-first-code-contribution)
    * [Local Dev Environment](#local-environment)
    * [Loading The Extension](#loading-the-extension)
    * [Getting Developer Help](#getting-developer-help)
  * [Pull Requests](#pull-requests)

Snap Links is a volunteer effort.  We encourage you to pitch in and help however you can!

## Reporting Bugs
__Ensure the bug is not already reported__ by searching on Github under [Issues][Issues-Bugs].

If you're unable to find an open issue addressing the problem, [open a new one][Issues-New].

__Be sure to include__:

  * *__A clear title and description__*.
  * A __publicly accessible link__ and instructions on reproducing the issue.
  * If possible *a screenshot or quick video* demonstrating the issue.
  * Any other *relevant details* that you can think of.


## Suggesting Enhancements
__Ensure the feature is not already requested__ by searching on Github under [Issues][Issues-Enh].

If you're unable to find an open issue relating to the feature, [open a new one][Issues-New].

## **Your First Code Contribution**
Mozilla authors and maintains fabulous documentation and tutorials at Mozilla Developer Network (MDN).  A great first read for web extensions is [Anatomy of an extension][MDN-Ext-Anatomy]

### Local Environment
You'll need to setup the project locally and install a few tools to build Snap Links for yourself.

1. Start by ![Forking][ForkIcon] [Forking][ForkRepo] Snap Links to your own area on github.
2. Install [git](https://git-scm.com/downloads) and [node.js](https://nodejs.org/en/download/) on your machine, as necessary.
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
    npm install -g yarn gulp@^4 gulp-cli

    # Install the node packages for SnapLinks (these will go into node_modules/)
    yarn install
    ```

### Building the extension

To build the extension we use the gulp v4 build system.
  * Use <kbd>gulp</kbd> to build the Chrome and Firefox builds.
  * Use <kbd>gulp watch</kbd> to build updated versions as you modify files.  This way most of the time you'll simply need to refresh the page you're on.
    * Sometimes you'll need to inform the browser to reload the extension.  <br>
    If you have Developer Mode turned on and SnapLinks is loaded on a page, you can
    hold down <kbd>Ctrl + Alt</kbd> and <kbd>right-click</kbd> to have Snap Links tell the browser to unload and reload SnapLinks.

By default, gulp will build the web extension in your project directory under build/chrome and build/ff.

### Loading the extension

#### ![Firefog Logo][FF16] Firefox

You'll need to be using [Firefox Developer][FF-DevEd] edition, and set your *xpinstall.signatures.required* to false in *about:config*.

There are a number of methods for loading the extension into Firefox, I prefer to use is with a *proxy file*.

Find the extension directory for your profile (on Windows, typically `%APPDATA%\Mozilla\Firefox\Profiles\...\extensions`).  Create a text file there named `snaplinks@snaplinks.mozdev.org` and in that file should be the path to your firefox build (`C:\code\WebExt\SnapLinks3\build\ff` on my machine).

**Note:** It's a good idea to keep a copy of that file elsewhere, sometimes Firefox will delete it under some conditions, especially when first being put in place.  Once you put that file in place start (or restart) Firefox and go to your addons and enable the extension.  If it is not showing, then it probably deleted that proxy file; in that case close Firefox and try again.

#### ![Chrome Logo][CH16] Chrome

Go to your extensions page, at the top right, check the box labeled **Developer Mode**, then click the button labeled **Load unpacked extension**and select the build\chrome directory.

You'll need to keep Developer Mode active for the extension to continue functioning.

## Getting Developer Help

If you have any questions or trouble getting things up and running, please feel free to join the [gitter channel][Gitter-Lobby], I'd be happy to help.

## Pull Requests

  * Open a new Github pull request with the patch.
  * Ensure the PR description links to the [open issue][Issues-Open] and clearly describes the solution.





[Links](Links.md ':include')
