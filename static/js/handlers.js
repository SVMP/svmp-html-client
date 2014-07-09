function handleResponse(resp) {
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
			break;
		case 3: //SCREENINFO
			console.log("Received SCREENINFO: " + resp.screenInfo.x + ", " + resp.screenInfo.y);
			break;
		case 4: //VIDSTREAMINFO
			console.log("Received VIDSTREAMINFO:\niceServers: " + resp.videoInfo.iceServers + "\npcConstraints: " + resp.videoInfo.pcConstraints + "\nvideoConstraints: " + resp.videoInfo.videoConstraints);
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
			console.log(resp.webrtcMsg);
			break;
		case 12: //PING
			console.log("Pong!");
			break;
		case 13: //APPS
			console.log("Received APPS");
			break;
	}
}