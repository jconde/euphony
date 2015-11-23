"use strict"

///////
// Room

var room = angular.module('Room', []);

///////////
// Config

room.config(function($sceDelegateProvider) {
  $sceDelegateProvider.resourceUrlWhitelist([
   'self',
   "http**",
	 "blob**"
  ]);
});

///////////////
// Controller

room.controller('Ctrl',['$scope','Room',function ($scope,Room/*,$location,$anchorScroll*/) {
  
  $scope.$on('localVideo.update', function (e) {
		if (Room.localStream)
			$scope.localVideo = URL.createObjectURL(Room.localStream);
		else
			$scope.localVideo = null;
		if ($scope.status.streamType == 'camera')
			$scope.localVideoTransform = '-webkit-transform : scaleX(-1)';
		else
			$scope.localVideoTransform = '';
		$scope.$apply();
  });
	
	$scope.$on('userVideo.update', function (e,user) {
		$scope.$apply($scope.users[user].video = Room.users[user].streams.map(function(stream) { return URL.createObjectURL(stream) }));
	});
	
	$scope.$on('userlist.update', function (e) {
		$scope.$apply($scope.users = Room.users);
	});
	
	$scope.$on('messageLog.update', function (e) {
		$scope.$apply($scope.messageLog = Room.messageLog);
		e = $('#messageLog');
		e.scrollTop(e[0].scrollHeight);
	});
  
	Room.init();
	
	$scope.log = function (x) { console.log(x); };
	
	$scope.room = Room;
	$scope.username = Room.username;
	$scope.roomname = Room.roomname;
  $scope.users = Room.users;
	$scope.status = Room.status;
	$scope.messageLog = Room.messageLog;
	$scope.msg = "";
	
	setInterval(function(){
			if (document.URL != Room.url)
				location.reload();
		}, 
	1000);
	
}]);



////////////
// Service


room.service('Room', ['$rootScope', function($rootScope) {
  var room = {
    
		cons : {
			camera : {'video': true, 'audio': true},
			audioOnly : {'video': false, 'audio': true},
			screen : {'video': {mandatory: {chromeMediaSource: 'screen'}}, 'audio': false}
		},

		status : {
			connected : false,
			muted : false,
			smuted : false,
			vmuted : false,
			mod : false,
			streamType : 'camera',
		},
		
		roomname : "",
		username : "",
		localStream : null,
    users : {},
		socket : "",
		messageLog : [],
		
		init : function() {
			if (document.URL.match(/#/g).length !== 1) {
				var name = prompt("Please enter your user name","");
				window.location.href = document.URL + '#' + name;	// Needs to be changed
			}
			this.url = document.URL;
			this.username = document.URL.split('#').pop() || '';
			this.roomname = document.URL.split('/').pop().split('#')[0];
			this.socket = io(document.URL.split(this.roomname)[0]);
			this.status.connected = true;
			
			// Socket events init
			
			this.socket.on('connect', function() {
				this.emit('login', room.username, room.roomname);
				console.log('Room: ' + room.roomname + ', User: ' + room.username);
			});
			
			this.socket.on('userlist', function(list) {
				if (list.length>0)
					document.body.style.backgroundImage = 'url(bg2.jpg)';
				list.map(function(x) { room.users[x] = { 'pc' : '', 'streams' : [], 'dc' : {}, 'stats' : {}, 'status' : { 'muted' : false } }; });
				room.initStream(room.cons.camera);
			});
			
			this.socket.on('hello', function(from, data) {
				document.body.style.backgroundImage = 'url(bg2.jpg)';
				room.userAdd(from);
			});

			this.socket.on('bye', function(from, data) {
				room.userDel(from);
				if (Object.keys(room.users).length == 0)
					document.body.style.backgroundImage = 'url(bg.jpg)';
			});
			
			this.socket.on('message', function(from, data) {
				if (from !== room.username) {
					var d = new Date();
					var minutes = d.getMinutes() > 9 ? d.getMinutes() : '0' + d.getMinutes();
					room.messageLog.push({ 'user' : from, 'msg' : data, 'time' : d.getHours() + ':' + d.getMinutes() });
					$rootScope.$broadcast('messageLog.update');
				}
			});
			
			this.socket.on('offer', function(from, data) {
				console.log('Call received: ' + JSON.stringify(data));
				if (!room.status.muted)
					room.users[from].pc.addStream(room.localStream);
				room.users[from].pc.setRemoteDescription(new RTCSessionDescription(data));
				room.users[from].pc.createAnswer(function(answer) {
					room.users[from].pc.setLocalDescription(answer);
					room.socket.emit('answer', from, answer);
				}, null, {});
			});
			
			this.socket.on('answer', function(from, data) {
				console.log('Response received: ' + JSON.stringify(data));
				room.users[from].pc.setRemoteDescription(new RTCSessionDescription(data));
			});
			
			this.socket.on('ice', function(from, data) {
				console.log('ICE  candidate received: ' + JSON.stringify(data));
				if (data)
					room.users[from].pc.addIceCandidate(new RTCIceCandidate(data));
			});
			
			this.socket.on('admin', function(user, data) {
				console.log('Updated status: ' + JSON.stringify(data));
				if (room.username === user)
					switch (data) {
						case 'mod': room.status.mod = true;
												break;
						case 'mute': room.status.muted = true;
												 for (var user in room.users)
													 room.users[user].pc.removeStream(room.localStream);
												 room.localStream.stop();
												 break;
						case 'unmute': room.status.muted = false;
													 room.initStream(room.cons.camera);
													 break;
					}
				else
					switch(data) {
						case 'mute': room.users[user].status.muted = true;
												 break;
						case 'unmute': room.users[user].status.muted = false;
													 break;
					}
			});
			
			this.socket.on('disconnect', function() {
				for (var user in room.users)
					room.userDel(user);
				if (room.localStream)
					room.localStream.stop();
			});
		},
    
		userAdd : function(user) {
			if (user) {
				if (!this.users[user])
					this.users[user] = { 'pc' : '', 'streams' : [], 'dc' : {}, 'stats' : {}, 'status' : { 'muted' : false } };
				this.users[user].pc = new webkitRTCPeerConnection({iceServers:[{url:"stun:stun.l.google.com:19302"}]}, {optional: [{RtpDataChannels: true}]});
				this.users[user].pc.onconnecting = function(message) { console.log("Connecting.."); };
				this.users[user].pc.onopen = function(message) { console.log("Call established."); };
				this.users[user].pc.onaddstream = function (event) {
					console.log("Stream coming from the other side.");
					room.users[user].streams.push(event.stream);
					$rootScope.$broadcast('userVideo.update',user);
					room.users[user].stats.catcher = setInterval(room.getBitrate, 5000, user);
				};
				this.users[user].pc.onremovestream = function (event) {
					console.log("Stream removed from the other side");
					room.users[user].streams.splice(room.users[user].streams.indexOf(event.stream),1);
					$rootScope.$broadcast('userVideo.update',user);
					clearInterval(room.users[user].stats.catcher);
					room.users[user].stats = {};
				};
				this.users[user].pc.onicecandidate = function (event) { room.socket.emit('ice', user, event.candidate); };
				if (!this.status.muted)
					this.users[user].pc.addStream(this.localStream);
				this.users[user].pc.ondatachannel = function (event) { if (room.users[user].dc === {}) room.initDC(user, event.channel); };
				$rootScope.$broadcast('userlist.update');
			}
		},
  
    userDel : function(user) {
			if (this.users[user]) {
				clearInterval(this.users[user].stats.catcher);
				delete this.users[user];
			}
			$rootScope.$broadcast('userlist.update');
    },
    
    call : function(user) {
      if (typeof(this.users[user]) !== 'undefined') {
        if (this.users[user].dc === '')
					this.initDC(user, this.users[user].pc.createDataChannel('data', { reliable: true }));
				this.users[user].pc.createOffer(function(offer) {
					room.users[user].pc.setLocalDescription(offer);
					room.socket.emit('offer', user, offer);
				}, null, {});
			}
    },
		
		sendMsg : function(msg) {
			var d = new Date();
			var minutes = d.getMinutes() > 9 ? d.getMinutes() : '0' + d.getMinutes();
			this.messageLog.push({ 'user' : this.username, 'msg' : msg, 'time' : d.getHours() + ':' + minutes });
			this.socket.emit('message',msg);
			$rootScope.$broadcast('messageLog.update');
		},
		
		switchStream : function(type) {
			this.status.streamType = type;
			if (this.status.streamType !== type)
				this.initStream(this.cons[type]);
		},
		
		initStream : function(cons) {
			navigator.webkitGetUserMedia(cons, this.onMediaSuccess, this.onMediaError);
		},
		
		onMediaSuccess : function(stream) {
			var oldStream = room.localStream;
			room.localStream = stream;
			for (var user in room.users) {
				if (room.users[user].pc === '')
					room.userAdd(user);
				if (oldStream)
					room.users[user].pc.removeStream(oldStream);
				if (!room.status.muted)
					room.users[user].pc.addStream(room.localStream);
				room.call(user);
			}
			if (oldStream)
				oldStream.stop();
			$rootScope.$broadcast('localVideo.update');
		},
		
		onMediaError : function(error) {
			alert("Error on getUserMedia: " + error);
		},
		
		initDC : function(user, channel) {
			this.users[user].dc = {};
			this.users[user].dc.buffer = [];
			this.users[user].dc.sending = false;

			channel.onopen = function() { console.log('Channel created with ' + user); };
			channel.onclose = function() { console.log('Channel closed with ' + user); };
			channel.onerror = function(err) { console.log('Channel error: ' + err); };
			this.users[user].dc.channel = channel;
		},
		
		admin : function(op,user) {
			if (user == this.username)
				switch (op) {
					case "smute":
						this.status.smuted = !this.status.smuted;
						this.localStream.getAudioTracks().forEach(function (track) {
							track.enabled = !room.status.smuted;
						});
						break;
					case "vmute":
						this.status.vmuted = !this.status.vmuted;
						this.localStream.getVideoTracks().forEach(function (track) {
							track.enabled = !room.status.vmuted;
						});
						break;
				}
			else
				this.socket.emit('admin', user, op);
		},
		
		getBitrate : function(user) {
			room.users[user].pc.getStats(function f(stats) {
				var results = stats.result();
				results.map(function(res) {
					if (res.type == 'ssrc' && res.stat('googFrameHeightReceived')) {
						var bytesNow = res.stat('bytesReceived');
						if (room.users[user].stats.timestampPrev) {
							var bitRate = Math.round((bytesNow - room.users[user].stats.bytesPrev) * 8 / (res.timestamp - room.users[user].stats.timestampPrev));
							console.log(user + ': ' + bitRate + ' kbits/sec');
							room.users[user].stats.bitRate = bitRate;
						}
						room.users[user].stats.bytesPrev = bytesNow;
						room.users[user].stats.timestampPrev = res.timestamp;
					}
				});
			});
		}
  };
  
  return room;
  
}]);


///////////////
// Directives

room.directive("chatInput", ['Room', function (Room) {
	return {
		link: function(scope,element,attrs) {
			element.bind("keypress", function(e) {
				if (e.which === 13 && scope.msg != '') {
					Room.sendMsg(scope.msg);
					scope.$apply(scope.msg = '');
				}
			});
		}
	};
}]);


room.directive("button", ['Room', function (Room) {
  return {
    restrict: "A",
    link: function(scope,element,attr) {
      element.bind("click", function() {
        console.log(element[0].innerText);
        if (element[0].innerText.match('Add'))
          Room.userAdd(scope.uid,scope.pc);
        else if (element[0].innerText.match('Del'))
          Room.userDel(scope.uid);
        else
          Room.call(scope.uid);
      });
    }
  };
}]);


room.directive('showonhover',function() {
	return {
		link : function(scope, element, attrs) {
			element.bind('mouseenter', function() {
				element.siblings().fadeIn();
			});
		}
	};
});


room.directive('hideonleave',function() {
	return {
		link : function(scope, element, attrs) {
			element.bind('mouseleave', function() {
				element.fadeOut();
			});
		}
	};
});