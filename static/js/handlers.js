function maybePlay() {
	if(document.getElementById("rtcvidstream") <= HTMLMediaElement.HAVE_CURRENT_DATA) {
		setTimeout(500, maybePlay);
	}
	else {
		document.getElementById("rtcvidstream").play();
	}
}

function setPlayerDimensions(w, h) {
	var vid = document.getElementById("rtcvidstream");
	vid.setAttribute("width", w);
	vid.setAttribute("height", h);
	var canv = document.getElementById("touchcanvas");
	canv.setAttribute("width", w);
	canv.setAttribute("height", h);
}

function updateLocation(pbuf, provider) {
	navigator.geolocation.getCurrentPosition(function(pos) {
		var locUpdate = new pbuf.LocationUpdate({
			"latitude" : pos.coords.latitude,
			"longitude" : pos.coords.longitude,
			"time" : pos.timestamp,
			"provider" : provider,
			"accuracy" : pos.coords.accuracy,
			"altitude" : pos.coords.altitude,
			"bearing" : pos.coords.heading,
			"speed" : pos.coords.speed
		});
		var locUpdateRequest = new pbuf.Request({"type" : pbuf.Request.RequestType.LOCATION, "locationRequest" : new pbuf.LocationRequest({"type" : pbuf.LocationRequest.LocationRequestType.LOCATIONUPDATE, "update" : locUpdate})});
		var locUpdateContainer = new pbuf.Container({"type" : pbuf.Container.ContainerType.REQUEST, "request" : locUpdateRequest});
		window.socket.send(locUpdateContainer.encode().toArrayBuffer());
	},
	function(err) {
		return;
	},
	{
		enableHighAccuracy: (provider == "GPS_PROVIDER"),
		timeout: 1000,
		maximumAge: 0
	});
}

function repeatUpdateLocation(pbuf, provider, timeout) {
	updateLocation(pbuf, provider);
	window.setTimeout(repeatUpdateLocation, timeout, pbuf, provider, timeout);
}

function handleResponse(resp, socket, pbuf) {
	switch(resp.type) {
		case pbuf.Response.ResponseType.ERROR:
			console.log("Error-type response; message: " + resp.message);
			break;
		case pbuf.Response.ResponseType.AUTH:
			switch(resp.authResponse.type) {
				case pbuf.AuthResponse.AuthResponseType.AUTH_OK: //AUTH_OK
					window.authenticated = true;
					break;
				case pbuf.AuthResponse.AuthResponseType.AUTH_FAIL: //AUTH_FAIL
					alert("Auth failed!");
					break;
				case pbuf.AuthResponse.AuthResponseType.SESSION_MAX_TIMEOUT: //SESSION_MAX_TIMEOUT
				case pbuf.AuthResponse.AuthResponseType.SESSION_IDLE_TIMEOUT: //SESSION_IDLE_TIMEOUT
				case pbuf.AuthResponse.AuthResponseType.NEED_PASSWORD_CHANGE: //NEED_PASSWORD_CHANGE
				case pbuf.AuthResponse.AuthResponseType.PASSWORD_CHANGE_FAIL: //PASSWORD_CHANGE_FAIL
					console.log("Got an unhandled authResponse type");
					break;
			}
			break;
		case pbuf.Response.ResponseType.VMREADY:
			// VM is ready.
			console.log("Received VMREADY: " + resp.message);
			paramcont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.VIDEO_PARAMS})}); // Send VIDEO_PARAMS
			socket.send(paramcont.encode().toArrayBuffer());
			sinfo = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.SCREENINFO})}); // Send SCREENINFO
			socket.send(sinfo.encode().toArrayBuffer());
			providerinfo = new pbuf.LocationProviderInfo({"provider" : "GPS_PROVIDER",
														  "requiresNetwork" : true,
														  "requiresSatellite" : true,
														  "requiresCell" : true,
														  "hasMonetaryCost" : false,
														  "supportsAltitude" : true,
														  "supportsSpeed" : true,
														  "supportsBearing" : true,
														  "powerRequirement" : 1,
														  "accuracy" : 1
														 });
			locReq = new pbuf.LocationRequest({"type" : pbuf.LocationRequest.LocationRequestType.PROVIDERINFO, "providerInfo" : providerinfo});
			locReqCont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.LOCATION, "locationRequest" : locReq})});
			socket.send(locReqCont.encode().toArrayBuffer());
			providerinfo.provider = "NETWORK_PROVIDER";
			socket.send(locReqCont.encode().toArrayBuffer());
			window.currtouches = [];
			break;
		case pbuf.Response.ResponseType.SCREENINFO:
			console.log("Received SCREENINFO: " + resp.screenInfo.x + ", " + resp.screenInfo.y);
			window.screeninfoX = resp.screenInfo.x;
			window.screeninfoY = resp.screenInfo.y;
			setTimeout(function() {
				window.xsf = window.screeninfoX / document.documentElement.clientWidth;
				window.ysf = window.screeninfoY / document.documentElement.clientHeight;
			}, 500);
			setPlayerDimensions(window.screeninfoX, window.screeninfoY);
			window.rotation = 0;
			break;
		case pbuf.Response.ResponseType.VIDSTREAMINFO:
			console.log("Received VIDSTREAMINFO:\niceServers: " + resp.videoInfo.iceServers + "\npcConstraints: " + resp.videoInfo.pcConstraints + "\nvideoConstraints: " + resp.videoInfo.videoConstraints);
			// Do something with iceServers
			rtcmsgreq = new pbuf.Request({"type" : pbuf.Request.RequestType.WEBRTC}); //WEBRTC
			rtcmsg = new pbuf.WebRTCMessage({"type" : pbuf.WebRTCMessage.WebRTCType.OFFER}); //OFFER
			window.rtcpeer = RTCPeerConnection({
				attachStream 	: null,
				onICE			: function(candidate) {
					tmpreq = new pbuf.Request({"type" : pbuf.Request.RequestType.WEBRTC}); //WEBRTC
					tmprtc = new pbuf.WebRTCMessage({"type" : pbuf.WebRTCMessage.WebRTCType.CANDIDATE, "json" : JSON.stringify(candidate)}); //CANDIDATE
					tmpreq.webrtcMsg = tmprtc
					rtccont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : tmpreq});
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
					window.addEventListener("deviceorientation", function(ev) { handleRotation(ev, socket, pbuf); });
				},
				onOfferSDP		: function(sdp) {
					tmpreq = new pbuf.Request({"type" : pbuf.Request.RequestType.WEBRTC}); //WEBRTC
					tmprtc = new pbuf.WebRTCMessage({"type" : pbuf.WebRTCMessage.WebRTCType.OFFER, "json" : JSON.stringify(sdp)}); //OFFER
					tmpreq.webrtcMsg = tmprtc;
					rtccont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : tmpreq});
					socket.send(rtccont.encode().toArrayBuffer());
				}
			});
			break;
		case pbuf.Response.ResponseType.INTENT:
			console.log("Received INTENT:\naction: " + resp.intent.action + "\ndata: " + resp.intent.data);
			switch(resp.intent.action) {
				case pbuf.IntentAction.ACTION_VIEW: //ACTION_VIEW
					console.log("Somehow got an ACTION_VIEW");
					break;
				case pbuf.IntentAction.ACTION_DIAL: //ACTION_DIAL
					window.open(resp.intent.data, "_blank");
					break;
			}
			break;
		case pbuf.Response.ResponseType.NOTIFICATION:
			console.log("Received NOTIFICATION");
			alert(resp.notification.contentTitle + "\n" + resp.notification.contentText);
			break;
		case pbuf.Response.ResponseType.LOCATION:
			switch(resp.locationResponse.type) {
				case pbuf.LocationResponse.LocationResponseType.SUBSCRIBE:
					switch(resp.locationResponse.subscribe.type) {
						case pbuf.LocationSubscribe.LocationSubscribeType.SINGLE_UPDATE:
							updateLocation(resp.locationResponse.subscribe.provider);
						case pbuf.LocationSubscribe.LocationSubscribeType.MULTIPLE_UPDATES:
							if(typeof(resp.locationResponse.subscribe.minDistance) == "undefined") {
								window.locationUpdateID = window.setTimeout(repeatUpdateLocation, resp.locationResponse.subscribe.minTime, pbuf, resp.locationResponse.subscribe.provider, resp.locationResponse.subscribe.minTime);
							}
							else {
								updateLocation(pbuf, resp.locationResponse.subscribe.provider);
							}
					}
					break;
				case pbuf.LocationResponse.LocationResponseType.UNSUBSCRIBE:
					// Do unsubscription
					if(window.locationUpdateID != null) {
						window.clearTimeout(window.locationUpdateID);
						window.locationUpdateID = null;
					}
					break;
			}
			console.log("Received LOCATION");
			break;
		case pbuf.Response.ResponseType.VIDEOSTART:
		case pbuf.Response.ResponseType.VIDEOSTOP:
		case pbuf.Response.ResponseType.VIDEOPAUSE:
			break;
		case pbuf.Response.ResponseType.WEBRTC:
			// Handle WebRTC message
			console.log("Received WebRTC: " + resp.webrtcMsg);
			switch(resp.webrtcMsg.type) {
				case pbuf.WebRTCMessage.WebRTCType.OFFER: //OFFER
					console.log("Ignoring WebRTC offer");
					break;
				case pbuf.WebRTCMessage.WebRTCType.ANSWER: //ANSWER
					window.rtcpeer.addAnswerSDP(JSON.parse(resp.webrtcMsg.json));
					break;
				case pbuf.WebRTCMessage.WebRTCType.BYE:
					console.log("WebRTC message with bad type: " + resp.webrtcMsg.type);
					break;
				case pbuf.WebRTCMessage.WebRTCType.CANDIDATE: //CANDIDATE
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
		case pbuf.Response.ResponseType.PING:
			console.log("Pong!");
			break;
		case pbuf.Response.ResponseType.APPS:
			console.log("Received APPS");
			break;
	}
}

function handleTouch(ev, socket, pbuf, touchtype) {
	ev.preventDefault();
	var touchmsg = new pbuf.TouchEvent({});
	var touchmsgs = new Array();
	var canvas = document.getElementById("touchcanvas");
	for(var i = 0; i < window.currtouches.length; i++) {
		var scaledX = 0;
		var scaledY = 0;
		if(window.isMobile) {
			scaledX = window.currtouches[i].pageX * window.xsf;
			scaledY = window.currtouches[i].pageY * window.ysf;
		}
		else {
			scaledX = window.currtouches[i].pageX - canvas.offsetLeft;
			scaledY = window.currtouches[i].pageY - canvas.offsetTop;
		}
		var msg = new pbuf.TouchEvent.PointerCoords({"id" : window.currtouches[i].identifier, "x" : scaledX, "y" : scaledY});
		touchmsgs.push(msg);
	}
	if(touchtype != 2) {
		for(var i = 0; i < window.currtouches.length; i++) {
			touchmsg.items = touchmsgs;
			touchmsg.action = ((window.currtouches[i].identifier > 0 ? touchtype + 5 : touchtype) | (window.currtouches[i].identifier << 8));
			var cont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.TOUCHEVENT, "touch" : touchmsg})});
			socket.send(cont.encode().toArrayBuffer());
		}
	}
	else {
		touchmsg.items = touchmsgs;
		touchmsg.action = touchtype;
		var cont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.TOUCHEVENT, "touch" : touchmsg})});
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

function handleMouseStart(ev, socket, pbuf) {
	window.currtouches.push({ identifier : 0, pageX : ev.pageX, pageY : ev.pageY });
	handleTouch(ev, socket, pbuf, 0)
}

function handleTouchEnd(ev, socket, pbuf) {
	handleTouch(ev, socket, pbuf, 1);
	for(var i = 0; i < ev.changedTouches.length; i++) {
		window.currtouches.splice(findTouch(ev.changedTouches[i].identifier), 1);
	}
}

function handleMouseEnd(ev, socket, pbuf) {
	handleTouch(ev, socket, pbuf, 1);
	window.currtouches = Array();
}

function handleTouchMove(ev, socket, pbuf) {
	for(var i = 0; i < ev.changedTouches.length; i++) {
		window.currtouches.splice(findTouch(ev.changedTouches[i].identifier), 1, copyTouch(ev.changedTouches[i]));
	}
	handleTouch(ev, socket, pbuf, 2);
}

function handleMouseMove(ev, socket, pbuf) {
	if(window.currtouches.length != 0) {
		window.currtouches.splice(findTouch(0), 1, { identifier : 0, pageX : ev.pageX, pageY : ev.pageY });
		handleTouch(ev, socket, pbuf, 2);
	}
}

function handleRotation(ev, socket, pbuf) {
	var beta = ev.beta;
	var gamma = ev.gamma;
	var diff = Math.abs(beta) - Math.abs(gamma);
	if(diff < 0) { // |Gamma| > |Beta|
		if(Math.abs(gamma) > 45) {
			if(window.rotation % 2 == 0) {
				window.rotation = 2 + Math.round(gamma / Math.abs(gamma));
				//setPlayerDimensions(window.screenY, window.screenX);
				window.canvasctx.save();
				window.canvasctx.rotate((window.rotation - 2) * 90 * Math.PI / 180);
				window.canvasctx.restore();
			}
		}
		else {
			if(window.rotation != 0) {
				//setPlayerDimensions(window.screenX, window.screenY);
				window.canvasctx.save();
				window.canvasctx.rotate((window.rotation - 2) * -90 * Math.PI / 180);
				window.canvasctx.restore();
				window.rotation = 0;
			}
		}
	}
	else {
		if(window.rotation != 0) {
			//setPlayerDimensions(window.screenX, window.screenY);
			window.canvasctx.save();
			window.canvasctx.rotate((window.rotation - 2) * -90 * Math.PI / 180);
			window.canvasctx.restore();
			window.rotation = 0;
		}
	}
	var cont = new pbuf.Container({"ctype" : pbuf.Container.ContainerType.REQUEST, "request" : new pbuf.Request({"type" : pbuf.Request.RequestType.ROTATION_INFO, "rotationInfo" : new pbuf.RotationInfo({"rotation" : window.rotation})})});
	socket.send(cont.encode().toArrayBuffer());
}