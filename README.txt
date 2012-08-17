SETUP
1. Install Java Development Kit (JDK).
2. Install Eclipse, e.g. Java EE package.
3. Install a Mercurial client, e.g. TortoiseHg.
3. Clone the repository.
4. Start Eclipse.
5. Add the project to Eclipse.
	- "File" -> "New" -> "JavaScript Project"
	- Set the project name as "snaplinksplus".
	- Select "Create project from existing source" and set the directory to the repository.
	- Click "Finish".

DEVELOPMENT BUILDS
1. Open .externalToolBuilders folder on "Script Explorer".
2. Right-click on snaplinksplus-build-dev.launch and select "Run-as" --> "snaplinksplus-build-dev"

PREPARE FOR THE NEXT RELEASE
1. Update release.properties:
	- Check max. version numbers from https://addons.mozilla.org/en-us/firefox/pages/appversions/
	- Update firefox.maxVersion and seamonkey.maxVersion.
	- Update extension.subVersion (and extension.version, if needed)

UPLOAD NEW STRINGS TO BABELZILLA
1. Download "Snap_Links_Plus_all_locales_*.tar.gz" translation bundles to babelzilla directory.
2. Build a dev build.
3. Upload the latest xpi from dist\babelzilla to Babelzilla.org.

DOWNLOAD TRANSLATED STRINGS FROM BABELZILLA
1. Download "Snap_Links_Plus_selected_locales_*.tar.gz" translation bundles to babelzilla directory. Select only complete translations.
2. Update babelzilla\translators.properties, if there are new translators