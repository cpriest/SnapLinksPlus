/*
 *  process.js 
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  
 *  This file is part of Snap Links.
 *
 *  Snap Links is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Snap Links is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with Snap Links.  If not, see <http://www.gnu.org/licenses/>.
 */

var currentState=-1
var startBegining=0

var minY=0
var maxy=0

function initializeLoc(e){
	snaplTargetDoc = e.target.ownerDocument;

	if (snaplTargetDoc.defaultView.top instanceof Window){
		snaplTargetDoc = snaplTargetDoc;
	}

	clearRect();
	snaplX1 = Math.min(e.pageX,snaplTargetDoc.documentElement.offsetWidth + snaplTargetDoc.defaultView.pageXOffset);
	snaplY1 = e.pageY;
	snaplVisible=false;
}


function processTimeoutStartRect(){
	snaplIdTimeoutStart=0;

	initiateLoading();
	initiateYBoundaries();
	startRect()
	
	if((currentState!=-1 || startBegining ==1) && snaplDrawing){
		snaplIdTimeoutStart=window.setTimeout("processTimeoutRectContinue();",30);
		return;
	}
	stopLoading();
}

function initiateYBoundaries(){
	minY=-1;
	maxY=-1;
}

function initiateLoading(){
	currentState=0;
	startBegining=0;
}

function stopLoading(){
	currentState=-1;
	startBegining=0;
}

function stillLoading(){
	return (currentState!=-1 || startBegining == 1);
}

function processTimeoutRectContinue(){
	snaplIdTimeoutStart=0;
	
	if (startingLinkAnalysis){
		addRectZone(true);
	}else{
		addRectZone(false);
	}
	
	if((currentState!=-1 || startBegining == 1) && snaplDrawing){
		snaplIdTimeoutStart=window.setTimeout("processTimeoutRectContinue();",30);
		processTimeout();
	}else{
		processTimeout();
		updateStatusLabel();
		stopLoading();
		signalEndLoading();
	}
	updateStatusLabel();
}

function scrollUpdate(){
	if(!snaplDrawing)
		return;

	if(currentState!=-1){
		startBegining=1;
	}else{
		currentState=0;
	}
	processTimeoutRectContinue();
}


function snaplMinF(x,y){
	if(x==-1)
		return y;
	return (x<y)?x:y;
}


function snaplMaxF(x,y){
	if(x==-1)
		return y;
	return (x>y)?x:y;
}


function addRectZone(start){
	if(!snaplTargetDoc)
		return;

	var insertionNode = (snaplTargetDoc.documentElement) ? snaplTargetDoc.documentElement : snaplTargetDoc;
	var tg = snaplTargetDoc.defaultView;

	minY = snaplMinF(minY,tg.pageYOffset);
	maxY = snaplMaxF(maxY,tg.pageYOffset + tg.innerHeight);
			
	var j = 0;
	var i = 0;

	if(start)
		startingLinkAnalysis=1;

	if(currentState!=-1 || startBegining == 1){
		if(currentState == -1){
			startBegining=0;
			currentState=0;
		}
		max = currentState + 60;

		for(i=currentState;i<snaplTargetDoc.links.length;i++){
			var l=snaplTargetDoc.links[i];
			
			if(i>=max)
				break;
			
			if(!start){	
			   	var contains=0;
				for(k=0;k<snaplVisibleLinks.length;k++){
					if(snaplVisibleLinks[k]==l){
						contains=1;
						break;
					}
				}
				if(contains)
					continue;
			}
		
			var sz=content.document.defaultView.getComputedStyle(l, "font-size");

			var isz = 0;
			if(sz.fontSize.indexOf("px")>=0)
				isz=parseFloat(sz.fontSize);

			var b = snaplTargetDoc.getBoxObjectFor(l);

			if(!b || (b.y + b.height) < minY || b.y > maxY)
				continue;
			j++;
			
			max-=2;
			
			snaplMultiBoxesMode = snaplFineLinks || snaplMultiWord || snaplValueBold;

			// For each link we will find various boxes with its location (links might be spread over the document)
			// We'll also split text nodes because words are usually on a single line, but phrases might 
			//   be split across various lines (and getBoxObjectFor doesn't work well for those)
			// Also a link node might contain various nodes like images and divs with very different positions 
			//   due to styles
			if(snaplMultiBoxesMode){
				mb = new Array(); 				// MultiBoxes
				var explored = new Array();		// Explored nodes
				var nexps =  new Array();   	// Not yet explored nodes

				for(k=0;k<l.childNodes.length;k++){
					nexps.push(l.childNodes[k]);
				}
			
				for(m = 0; m < nexps.length; m++) {
					for(k=0;k<nexps[m].childNodes.length;k++){
						nexps.push(nexps[m].childNodes[k]);
					}	
					if(nexps[m].childNodes.length==0){
						if(snaplMultiWord){
							if(nexps[m].nodeType==Node.TEXT_NODE){
								str=nexps[m].data;
								if(str.indexOf(" ")!=-1){
									obj=nexps[m];
									while((plv = obj.data.indexOf(" "))!=-1){
										if(plv + 1 >= obj.data.length){
											break;
										}
										novo = obj.splitText(plv+1);
										nexps.push(novo);
										obj = novo;
									}
								}
							}
						}	
					   	
						if(nexps[m].parentNode.childNodes.length==1){	
							explored.push(nexps[m].parentNode);
						}else{
							var velho = nexps[m];
							var pai = velho.parentNode;
							var div = document.createElementNS("http://www.w3.org/1999/xhtml","html:null");
							div.appendChild(velho.cloneNode(false));
							pai.replaceChild(div,velho);
							
							nexps.push(div.childNodes[0]);
							nexps.push(div);

							explored.push(div);
						}
					}	
				}

				// Find the size of the link
				// It is not very exact because there might be invisible elements or non-text nodes 
				//   inside the link (and their size will be taken in to account)
				for(m=0;m<explored.length;m++){
					var lsz = content.document.defaultView.getComputedStyle(explored[m], "font-size");
					var lisz = 0;

					if(lsz.fontSize.indexOf("px")>=0)
						lisz = parseFloat(lsz.fontSize);

					// Links appear to be bigger if they are bold
					if(snaplValueBold){
						if(lisz>(isz-0.2)){
							var stl = content.document.defaultView.getComputedStyle(explored[m], "fonte-weight");
							var lbold = 400;
							lbold = parseFloat(stl.fontWeight);
							if(lbold > 400)
								lisz += 0.2
						}
					}
					if(lisz > isz){
						isz = lisz;
					}
				}
			
				for(m = 0; m < explored.length; m++) {
					var box = snaplTargetDoc.getBoxObjectFor(explored[m]);
					mb.push(box);
				}
			
				// Hack for the cases where a link has sub-nodes in different places	
				for(m = 0; m < nexps.length; m++) {
					try{
						var box = snaplTargetDoc.getBoxObjectFor(nexps[m]);
						mb.push(box);
					}catch(e){
					}
				}
			
				snaplMultiBoxes.push(mb); 
			}
		
			snaplTSize.push(isz);
			snaplVisibleLinks.push(l);
			snaplBoxes.push(b);
		}
		currentState=i;
		if(i >= (snaplTargetDoc.links.length - 1)){
			currentState=-1;
			startingLinkAnalysis=0;
		}
	}
}


function startRect(){
	var insertionNode = (snaplTargetDoc.documentElement) ? snaplTargetDoc.documentElement : snaplTargetDoc;

	var tg = snaplTargetDoc.defaultView;
	var minY = tg.pageYOffset;
	var maxY = tg.pageYOffset + tg.innerHeight;

	snaplLinks = new Array();
	snaplVisibleLinks = new Array();
	snaplBoxes = new Array();
	snaplTSize = new Array();
	snaplMultiBoxes = new Array();
 	
	addRectZone(true);

	return;
}


function createRect(x, y,insertionNode) {
	if (insertionNode  && snaplRect ) {
		snaplRect.style.left = x + "px"; 
		snaplRect.style.top = y + "px";
		insertionNode.appendChild(snaplRect);
	}
}

function rectVisible(){
	if(!snaplVisible){
		if(Math.abs(snaplX1-snaplX2)>4 || Math.abs(snaplY1-snaplY2)> 4){
			if(!snaplIdTimeoutStart){
			var insertionNode = (snaplTargetDoc.documentElement) ? snaplTargetDoc.documentElement : snaplTargetDoc;
				snaplRect = snaplTargetDoc.createElementNS(snaplXhtmlNS, "snaplRect");
				snaplRect.style.color = snaplBorderColor;
				snaplRect.style.border = snaplBorderWidth + "px dotted";

				snaplRect.style.position = "absolute";
				snaplRect.style.zIndex = "10000";
				createRect(snaplX1,snaplY1,insertionNode);
				snaplIdTimeoutStart=window.setTimeout("processTimeoutStartRect();",50);
			}
			snaplVisible=true;
			if(snaplShowNumber){
				updateStatus(msgPanelLinks + " " + "0");
			}
		}
	}
	return snaplVisible;
}


function selectZone(e){

	if(e.altKey){
		var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
			.rootTreeItem
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindow);
		var tabbrowser = mainWindow.document.getElementById("content");
		var minHeight = tabbrowser.selectedBrowser.boxObject.height;
		var minWidth = tabbrowser.selectedBrowser.boxObject.width;
																										   
		var tg = snaplTargetDoc.defaultView;
		var de = snaplTargetDoc.documentElement;
		var dX = e.pageX - snaplX2;
		var dY = e.pageY - snaplY2;
		snaplX1 += dX;
		snaplY1 += dY;
		snaplX1 = Math.max(Math.min(Math.max(snaplTargetDoc.width,minWidth),snaplX1),0);
		snaplY1 = Math.max(Math.min(Math.max(snaplTargetDoc.height,minHeight),snaplY1),0);
	}

	if(e.shiftKey){
		snaplEqualSize=false;
	}else{
		snaplEqualSize=true;
	}

	snaplX2 = Math.min(e.pageX,content.document.documentElement.offsetWidth + snaplTargetDoc.defaultView.pageXOffset);
	snaplY2 = e.pageY;

	if(!rectVisible())
		return;
	snaplRect.style.width = Math.abs(snaplX1-snaplX2) - snaplBorderWidth + "px";
	snaplRect.style.height = Math.abs(snaplY1-snaplY2) - snaplBorderWidth + "px";
	snaplRect.style.top = Math.min(snaplY1,snaplY2) - snaplBorderWidth + "px";
	snaplRect.style.left = Math.min(snaplX1,snaplX2) - snaplBorderWidth + "px";
	return;
}

function drawRect() {
	if(!rectVisible())
		return;
	controlLinks();
}

function controlLinks(){
	if(!snaplDrawing) return;

	var c_X1 = Math.min(snaplX1,snaplX2);
	var c_X2 = Math.max(snaplX1,snaplX2);
	var c_Y1 = Math.min(snaplY1,snaplY2);
	var c_Y2 = Math.max(snaplY1,snaplY2);

	var outlineFormat = snaplLinksBorderWidth + "px solid " + snaplLinksBorderColor; //"1px solid #ff0000";
	snaplLinks = new Array();
	var sz = 0;
	
	for(i=0;i<snaplVisibleLinks.length;i++){
		var l = snaplVisibleLinks[i];
		var link_ok;
		
		if(snaplMultiBoxesMode){
			link_ok=false;
			for(j=0;j<snaplMultiBoxes[i].length;j++){
				var l_X1 = snaplMultiBoxes[i][j].x;
				var l_Y1 = snaplMultiBoxes[i][j].y;
				var l_X2 = l_X1 + snaplMultiBoxes[i][j].width;
				var l_Y2 = l_Y1 + snaplMultiBoxes[i][j].height;
				
				if(l_Y1 < c_Y2 && l_Y2 > c_Y1 && l_X2 > c_X1 && l_X1 < c_X2){
					link_ok=true;
					break;
				}
			}
		}
		
		if(!snaplMultiBoxesMode){	
			var l_X1 = snaplBoxes[i].x;
			var l_Y1 = snaplBoxes[i].y;
			var l_X2 = l_X1 + snaplBoxes[i].width;
			var l_Y2 = l_Y1 + snaplBoxes[i].height;
	
			if(l_Y1 > c_Y2 || l_Y2 < c_Y1 || l_X2 < c_X1 ||l_X1 > c_X2){
				link_ok=false;
			}else{
				link_ok=true;
			}
		}

		if(link_ok==false){
			l.style.MozOutline = "";
		}else{
			if(snaplEqualSize){
				if(snaplTSize[i]<sz){
					l.style.MozOutline = "";
					continue;
				}
				if(snaplTSize[i]>sz){
					for(j=0;j<snaplLinks.length;j++){
						snaplLinks[j].style.MozOutline = "";
					}
					snaplLinks=new Array();
					sz=snaplTSize[i];
				}
			}
			l.style.MozOutline = outlineFormat;
			snaplLinks.push(l);
		}
	}
	if(snaplShowNumber){
		updateStatus(msgPanelLinks + " " + snaplLinks.length);
	}

}

// Its more precise but very slow and may be ugly
function changeOutline(obj,format){
	var i=0;

	try{
		obj.style.MozOutline = format;
	}catch(e){
	}
	
	for(i=0;i<obj.childNodes.length;i++){
		changeOutline(obj.childNodes[i],format);
	}
	return;
}

function clearRect() {
	snaplDrawing=false;
	if (snaplRect)
		snaplRect.parentNode.removeChild(snaplRect);
	snaplRect = null;
	
	if(snaplLinks && snaplLinks.length){
		for(i=0;i<snaplLinks.length;i++){
			snaplLinks[i].style.MozOutline = "none";
		}
		snaplLinks = null;
	}
	snaplRect = null;
	snaplX1=0; snaplX2=0; snaplY1=0; snaplY2=0;
	snaplVisible=false;
	displayInfo("");
	updateStatus("");
}


function executeAction(){

	if(snaplLinks && snaplLinks.length && snaplVisible){
		switch(snaplAction){
			case SNAPLACTION_TABS:
				openTabs();
				break;
			case SNAPLACTION_WINDOWS:
				openWindows();
				break;
			case SNAPLACTION_WINDOW:
				openTabsWindow();
				break;
			case SNAPLACTION_CLIPBOARD:
				saveCliboard();
				break;
			case SNAPLACTION_BOOKMARK:
				bookmarkLinks();
				break;
			case SNAPLACTION_DOWNLOAD:
			    snaplAction = SNAPLACTION_UNDEF
				downloadLinks();
		        snaplAction = SNAPLACTION_DEFAULT;
				break;
		}
	}	
}

function saveCliboard(){

	if(snaplLinks && snaplLinks.length && snaplVisible){
		htmlRepresentation = "";
		plainTextRepresentation = "";

		for(i=0;i<snaplLinks.length;i++){
			text = snaplLinks[i].textContent;
			text = text.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
			
			htmlRepresentation += "<a href=\"" + snaplLinks[i].href +"\">" + text + "</a>";
			plainTextRepresentation += 	snaplLinks[i].href;
			if ((i + 1)!= snaplLinks.length ){
				htmlRepresentation += "\n";
				plainTextRepresentation += " ";
			}
		}

		// Create the transferable
		var trans =
			Components.classes["@mozilla.org/widget/transferable;1"]
					.createInstance(Components.interfaces.nsITransferable);
		if ( trans ) {

			// Register the data flavors
			trans.addDataFlavor("text/html");
			trans.addDataFlavor("text/unicode");

			// Create the data objects
			var textWrapper =
				Components.classes["@mozilla.org/supports-string;1"]
						.createInstance(Components.interfaces.nsISupportsString);
			var htmlWrapper =
				Components.classes["@mozilla.org/supports-string;1"]
						.createInstance(Components.interfaces.nsISupportsString);

			if ( textWrapper && htmlWrapper ) {
				// Get the data
				textWrapper.data = plainTextRepresentation;
				htmlWrapper.data = htmlRepresentation;

				// Add data objects to transferable
				trans.setTransferData ( "text/html", htmlWrapper, 
					  htmlRepresentation.length * 2 );  	// double byte data (len*2)
				trans.setTransferData ( "text/unicode", textWrapper, 
					  plainTextRepresentation.length * 2);  // double byte data (len*2)
				
				var clipid = Components.interfaces.nsIClipboard;
				var clip   = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
				if (!clip) return false;

				clip.setData(trans, null, clipid.kGlobalClipboard);
			}
		}	
	}	
}

function openWindows(){
	var total = snaplLinks.length;
	var links = new Array();
	var i;
	if(snaplLinks && total && snaplVisible){
		for(i=0;i<total;i++){
			links.push(snaplLinks[i].href);
		}
		for(i=0;i<total;i++){
			var l = links[i];
			window.open(l,"snapl");
		}
	}
}

function openTabs(){
	if(snaplLinks && snaplLinks.length && snaplVisible){
		var sContent = document.getElementById("content");
		for(i=0;i<snaplLinks.length;i++){
			var l = snaplLinks[i].href;
			sContent.addTab(l,makeReferrer());
		}
	}
}

function openTabsWindow() {
	if(snaplLinks.length==0)
		return;

	var hand = Components.classes["@mozilla.org/browser/clh;1"].getService(Components.interfaces.nsIBrowserHandler);
	var urls = snaplLinks.join("|") || hand.defaultArgs;
   	return window.openDialog("chrome://browser/content/", "_blank", "all,chrome,dialog=no", urls);
}

function bookmarkLinks(){
	var linksInfo = [];
	try{
		for(i=0;i<snaplLinks.length;i++){
			var name = snaplLinks[i].textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
			var url = snaplLinks[i].href;
			linksInfo[i] = { name: name, url: url };
		}
		var dialogArgs;
		dialogArgs = { name: gNavigatorBundle.getString("bookmarkAllTabsDefault") };
		dialogArgs.bBookmarkAllTabs = true;
		dialogArgs.objGroup = linksInfo;
		openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "", BROWSER_ADD_BM_FEATURES, dialogArgs);
	}catch(e){
	}
}

function downloadLinks() {
	var i,j,k;
	var links = [];
	var total = snaplLinks.length;
	var names = [];
	var num=1;
	var MAX_ATMPS = 10;

	for(i=0;i<total;i++){
		links[i] = { href : snaplLinks[i].href, 
			textContent : snaplLinks[i].textContent.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ').replace(/ /g,'_')};

		var t = links[i].textContent;

		for(k=num;k<num+MAX_ATMPS;k++){
			var ok=true;
			for(j=0;j<names.length;j++){
				if(t == names[j]){
					ok=false;
					break;
				}
			}
			if(ok){
				links[i].textContent = t;
				names.push(t);
				break;
			}else{
				t = links[i].textContent + "" + num;
				num++;
			}					
		}

	}
	var ln;
	for(ln=0;ln<total;ln++){
		try{
			var url = links[ln].href;
			var referrer = makeReferrer(); 
			var bypassCache = true;
			var fileName = links[ln].textContent;
			var titleW = null;
			var skipPrompt = false;
			saveURL(url, fileName, false, bypassCache, skipPrompt, referrer);
		}catch(e){
		}
	}
}

function makeReferrer() {
	try {
		var ref = snaplTargetDoc.location.href;
		var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		if (ref){ 
			ref = ioService.newURI(ref, null, null);
			return ref
		}
					
	} catch (e) {
	}
	return null;
}

