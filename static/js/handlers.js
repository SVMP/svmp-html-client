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
			vparams = new pbuf.Request({"type" : 1}); //Send VIDEO_PARAMS
			paramcont = new pbuf.Container({"ctype" : 2, "request" : vparams});
			socket.send(paramcont.encode().toArrayBuffer());
			break;
		case 3: //SCREENINFO
			console.log("Received SCREENINFO: " + resp.screenInfo.x + ", " + resp.screenInfo.y);
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
					document.getElementById("rtcvidstream").setAttribute("class", "");
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