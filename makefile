.DEFAULT_GOAL := firefox

firefox:
	zip -r SnapLinksPlus.xpi src res LICENSE manifest.json
	@echo "To install SnapLinksPlus.xpi in Firefox be sure you can install unverified Add-ons:"
	@echo "about:config -> xpinstall.signatures.required = false"

chrome:
	#TODO
