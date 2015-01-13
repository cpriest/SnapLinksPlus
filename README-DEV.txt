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
Do this as soon as all the new strings have been added. It usually takes 1-2 weeks before the volunteers
finish their part. Remind the owners of incomplete translations or look for new translators on the forum.
1. Download Snap_Links_Plus_all_locales_skipped.tar.gz translation bundle to babelzilla directory.
2. Make a dev build.
3. Upload the latest xpi from dist\babelzilla to Babelzilla.org.

DOWNLOAD TRANSLATED STRINGS FROM BABELZILLA
Do this just before the release, so you will get the latest modifications in.
1. Download Snap_Links_Plus_selected_locales_replaced.tar.gz translation bundle to babelzilla directory.
   Note: Select only the translations which are 100 percent complete.
2. Update babelzilla\translators.properties, if there were new translators.
