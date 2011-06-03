/*
 *  process.js 
 *  Copyright (C) 2007  Pedro Fonseca (savred at gmail)
 *  Copyright (C) 2009  Tommi Rautava
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

var currentState=-1;
var startBegining=0;
var startingLinkAnalysis=0;

var minY=0;
var maxY=0;

function processTimeoutStartRect(){
	snaplIdTimeoutStart=0;

	initiateLoading();
	initiateYBoundaries();
	Log('processTimeoutStartRect');
	startRect();
	
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
	
	Log('processTimeoutRectContinue');
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
//		SnapLinks.UpdateStatusLabel();		/* Necessary?? */
		stopLoading();
		signalEndLoading();
	}
	SnapLinks.UpdateStatusLabel();
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
	
	Log('addRectZone');
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
		var max = currentState + 60;

		for(i=currentState;i<snaplTargetDoc.links.length;i++){
			var l=snaplTargetDoc.links[i];
			
			if(i>=max)
				break;
			
			if(!start){	
				var contains=0;
				for(var k=0;k<snaplVisibleLinks.length;k++){
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

			var b = snaplGetBoundingClientRect(l);

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
				var mb = new Array(); 			// MultiBoxes
				var explored = new Array();		// Explored nodes
				var nexps =  new Array();   	// Not yet explored nodes

				for(k=0;k<l.childNodes.length;k++){
					nexps.push(l.childNodes[k]);
				}
			
				for(var m = 0; m < nexps.length; m++) {
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
							var stl = content.document.defaultView.getComputedStyle(explored[m], "font-weight");
							var lbold = 400;
							lbold = parseFloat(stl.fontWeight);
							if(lbold > 400)
								lisz += 0.2;
						}
					}
					if(lisz > isz){
						isz = lisz;
					}
				}
			
				var box;
				for(m = 0; m < explored.length; m++) {
					box = snaplGetBoundingClientRect(explored[m]);
					mb.push(box);
				}
			
				// Hack for the cases where a link has sub-nodes in different places	
				for(m = 0; m < nexps.length; m++) {
					try{
						box = snaplGetBoundingClientRect(nexps[m]);
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
	
	Log('startRect');
	addRectZone(true);

	return;
}

function drawRect() {
	if(!SnapLinks.Selection.Create())
		return;
	controlLinks();
}

function controlLinks(){
	if(!snaplDrawing) return;

	var c = SnapLinks.Selection.NormalizedRect;

	var outlineFormat = snaplLinksBorderWidth + "px solid " + snaplLinksBorderColor; //"1px solid #ff0000";
	snaplLinks = new Array();
	var sz = 0;
	
	for(var i=0;i<snaplVisibleLinks.length;i++){
		var l = snaplVisibleLinks[i];
		var link_ok;
		
		if(snaplMultiBoxesMode){
			link_ok=false;
			for(var j=0;j<snaplMultiBoxes[i].length;j++){
				var l_X1 = snaplMultiBoxes[i][j].x;
				var l_Y1 = snaplMultiBoxes[i][j].y;
				var l_X2 = l_X1 + snaplMultiBoxes[i][j].width;
				var l_Y2 = l_Y1 + snaplMultiBoxes[i][j].height;
				
				if(l_Y1 < c.Y2 && l_Y2 > c.Y1 && l_X2 > c.X1 && l_X1 < c.X2){
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
	
			if(l_Y1 > c.Y2 || l_Y2 < c.Y1 || l_X2 < c.X1 ||l_X1 > c.X2){
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
	if(snaplShowNumber)
		SnapLinks.SnapLinksStatus = msgPanelLinks + ' ' + snaplLinks.length;
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

function makeReferrer() {
	try {
		var ref = snaplTargetDoc.location.href;
		var ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		if (ref){ 
			ref = ioService.newURI(ref, null, null);
			return ref;
		}
					
	} catch (e) {
	}
	return null;
}

function snaplGetBoundingClientRect(elem) {
	//var consoleService = Components.classes['@mozilla.org/consoleservice;1'].
	//	getService(Components.interfaces.nsIConsoleService);

	var box;
	
	if (elem.ownerDocument.getBoxObjectFor != null) {
		//consoleService.logStringMessage("Snaplinks: using getBoxObjectFor()");
		box = elem.ownerDocument.getBoxObjectFor(elem);
	} else {
		//consoleService.logStringMessage("Snaplinks: using getBoundingClientRect()");
		var rect = elem.getBoundingClientRect();
		var doc = elem.ownerDocument;
		var docElem = doc.documentElement;
		var scrollLeft = docElem.scrollLeft ? docElem.scrollLeft : doc.body.scrollLeft;
		var scrollTop = docElem.scrollTop ? docElem.scrollTop : doc.body.scrollTop;

		box = {
			x: rect.left + scrollLeft, 
			y: rect.top + scrollTop,
			width: rect.width,
			height: rect.height
		};
		//consoleService.logStringMessage("x="+ box.x +" y="+ box.y +" scrollLeft="+ scrollLeft +" scrollTop="+ scrollTop);
	}
	
	return box;
}
