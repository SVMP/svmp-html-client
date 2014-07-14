function maybePlay() {
	if(document.getElementById("rtcvidstream") <= HTMLMediaElement.HAVE_CURRENT_DATA) {
		setTimeout(500, maybePlay);
	}
	else {
		document.getElementById("rtcvidstream").play();
	}
}

function handleResponse(resp, socket, pbuf) {
	switch(resp.type) {
		case 0: //ERROR
			console.log("Error-type response; message: " + resp.message);
			break;
		case 1: //AUTH
			switch(resp.authResponse.type) {
				case 0: //AUTH_OK
					window.authenticated = true;
					break;
				case 1: //AUTH_FAIL
					alert("Auth failed!");
					break;
				case 2: //SESSION_MAX_TIMEOUT
				case 3: //SESSION_IDLE_TIMEOUT
				case 4: //NEED_PASSWORD_CHANGE
				case 5: //PASSWORD_CHANGE_FAIL
					console.log("Got an unhandled authResponse type");
					break;
			}
			break;
		case 2: //VMREADY
			// VM is ready.
			console.log("Received VMREADY: " + resp.message);
			paramcont = new pbuf.Container({"ctype" : 2, "request" : new pbuf.Request({"type" : 1})}); // Send VIDEO_PARAMS
			socket.send(paramcont.encode().toArrayBuffer());
			sinfo = new pbuf.Container({"ctype" : 2, "request" : new pbuf.Request({"type" : 6})}); // Send SCREENINFO
			socket.send(sinfo.encode().toArrayBuffer());
			window.currtouches = [];
			break;
		case 3: //SCREENINFO
			console.log("Received SCREENINFO: " + resp.screenInfo.x + ", " + resp.screenInfo.y);
			var vid = document.getElementById("rtcvidstream");
			vid.setAttribute("width", resp.screenInfo.x);
			vid.setAttribute("height", resp.screenInfo.y);
			var canv = document.getElementById("touchcanvas");
			canv.setAttribute("width", resp.screenInfo.x);
			canv.setAttribute("height", resp.screenInfo.y);
			break;
		case 4: //VIDSTREAMINFO
			console.log("Received VIDSTREAMINFO:\niceServers: " + resp.videoInfo.iceServers + "\npcConstraints: " + resp.videoInfo.pcConstraints + "\nvideoConstraints: " + resp.videoInfo.videoConstraints);
			// Do something with iceServers
			rtcmsgreq = new pbuf.Request({"type" : 9}); //WEBRTC
			rtcmsg = new pbuf.WebRTCMessage({"type" : 1}); //OFFER
			window.rtcpeer = RTCPeerConnection({
				attachStream 	: null,
				onICE			: function(candidate) {
					tmpreq = new pbuf.Request({"type" : 9}); //WEBRTC
					tmprtc = new pbuf.WebRTCMessage({"type" : 3, "json" : JSON.stringify(candidate)}); //CANDIDATE
					tmpreq.webrtcMsg = tmprtc
					rtccont = new pbuf.Container({"ctype" : 2, "request" : tmpreq});
					socket.send(rtccont.encode().toArrayBuffer());
				},
				onRemoteStream	: function(stream) {
					if(window.browser) {
						document.getElementById("rtcvidstream").mozSrcObject = stream;
					}
					else {
						document.getElementById("rtcvidstream").src = URL.createObjectURL(stream);
					}
					setTimeout(500, maybePlay);
					document.getElementById("loginbox").setAttribute("class", "hide");
					document.getElementById("touchcanvas").setAttribute("class", "");
				},
				onOfferSDP		: function(sdp) {
					tmpreq = new pbuf.Request({"type" : 9}); //WEBRTC
					tmprtc = new pbuf.WebRTCMessage({"type" : 1, "json" : JSON.stringify(sdp)}); //OFFER
					tmpreq.webrtcMsg = tmprtc;
					rtccont = new pbuf.Container({"ctype" : 2, "request" : tmpreq});
					socket.send(rtccont.encode().toArrayBuffer());
				}
			});
			break;
		case 5: //INTENT
			console.log("Received INTENT:\naction: " + resp.intent.action + "\ndata: " + resp.intent.data);
			break;
		case 6: //NOTIFICATION
			console.log("Received NOTIFICATION");
			break;
		case 7: //LOCATION
			switch(resp.locationResponse.type) {
				case 1:
					// Do subscription
					break;
				case 2:
					// Do unsubscription
					break;
			}
			console.log("Received LOCATION");
			break;
		case 8: //VIDEOSTART
		case 9: //VIDEOSTOP
		case 10: //VIDEOPAUSE
			break;
		case 11: //WEBRTC
			// Handle WebRTC message
			console.log("Received WebRTC: " + resp.webrtcMsg);
			switch(resp.webrtcMsg.type) {
				case 1: //OFFER
					console.log("Ignoring WebRTC offer");
					break;
				case 2: //ANSWER
					window.rtcpeer.addAnswerSDP(JSON.parse(resp.webrtcMsg.json));
					break;
				case 4:
					console.log("WebRTC message with bad type: " + resp.webrtcMsg.type);
					break;
				case 3: //CANDIDATE
				default:
					cand = JSON.parse(resp.webrtcMsg.json);
					console.log(cand);
					if(cand["type"] == "candidate") {
						window.rtcpeer.addICE({
							sdpMLineIndex: cand.sdpMLineIndex,
							candidate: cand.candidate
						});
					}
					else if(cand["type"] == "answer") {
						window.rtcpeer.addAnswerSDP(cand);
					}
					break;
			}
			break;
		case 12: //PING
			console.log("Pong!");
			break;
		case 13: //APPS
			console.log("Received APPS");
			break;
	}
}

function handleTouch(ev, socket, pbuf, touchtype) {
	ev.preventDefault();
	var touches = ev.changedTouches;
	var touchmsg = new pbuf.TouchEvent({});
	var touchmsgs = new Array();
	var canvas = document.getElementById("touchcanvas");
	var offsetX = canvas.offsetLeft;
	var offsetY = canvas.offsetTop;
	for(var i = 0; i < window.currtouches.length; i++) {
		var msg = new pbuf.TouchEvent.PointerCoords({"id" : window.currtouches[i].identifier, "x" : window.currtouches[i].pageX - offsetX, "y" : window.currtouches[i].pageY - offsetY});
		touchmsgs.push(msg);
	}
	if(touchtype != 2) {
		for(var i = 0; i < window.currtouches.length; i++) {
			touchmsg.items = touchmsgs;
			touchmsg.action = ((window.currtouches[i].identifier > 0 ? touchtype + 5 : touchtype) | (window.currtouches[i].identifier << 8));
			var cont = new pbuf.Container({"ctype" : 2, "request" : new pbuf.Request({"type" : 2, "touch" : touchmsg})});
			socket.send(cont.encode().toArrayBuffer());
		}
	}
	else {
		touchmsg.items = touchmsgs;
		touchmsg.action = touchtype;
		var cont = new pbuf.Container({"ctype" : 2, "request" : new pbuf.Request({"type" : 2, "touch" : touchmsg})});
		socket.send(cont.encode().toArrayBuffer());
	}
}

function copyTouch(touch) {
	return { identifier : touch.identifier, pageX : touch.pageX, pageY : touch.pageY };
}

function findTouch(id) {
	for(var i = 0; i < window.currtouches.length; i++) {
		if(id == window.currtouches[i].identifier) return i;
	}
	return -1;
}

function handleTouchStart(ev, socket, pbuf) {
	for(var i = 0; i < ev.changedTouches.length; i++) {
		window.currtouches.push(copyTouch(ev.changedTouches[i]));
	}
	handleTouch(ev, socket, pbuf, 0);
}

function handleTouchEnd(ev, socket, pbuf) {
	handleTouch(ev, socket, pbuf, 1);
	for(var i = 0; i < ev.changedTouches.length; i++) {
		window.currtouches.splice(findTouch(ev.changedTouches[i].identifier), 1);
	}
}

function handleTouchMove(ev, socket, pbuf) {
	for(var i = 0; i < ev.changedTouches.length; i++) {
		window.currtouches.splice(findTouch(ev.changedTouches[i].identifier), 1, copyTouch(ev.changedTouches[i]));
	}
	handleTouch(ev, socket, pbuf, 2);
}