// Node WebRTC

var https = require("https"); // Tiene que ser HTTPS porque Chrome no comparte la pantalla por HTTP
var url = require("url");
var fs = require("fs");
var util = require("util");

var httpsport = 443;

// HTTPS Web Server

var httpsoptions = {
	key: fs.readFileSync('server.key'),
	cert: fs.readFileSync('server.crt')
};

var webServer = https.createServer(httpsoptions, function (request, response) {

  var req = url.parse(request.url, true);
	var path = req.path; console.log(JSON.stringify(req));

	if (path == '/') {
		console.log('Index accessed.');
		fs.readFile('./index.html', function(err, html) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200);
				response.write(html);
				response.end();
			}
		});
		
	} else if (path == '/client.js') {
		console.log('Client accesed.');
		fs.readFile('./client.js', function (err, js) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200, {"Content-Type": 'text/javascript'});
				response.write(js);
				response.end();
			}
		});
		
	} else if (path == '/style.css') {
		fs.readFile('./style.css', function (err, css) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200, {"Content-Type": 'text/javascript'});
				response.write(css);
				response.end();
			}
		});
		
	} else if (path == '/bg.jpg') {
		fs.readFile('./bg.jpg', function (err, jpg) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200);
				response.write(jpg);
				response.end();
			}
		});
		
	} else if (path == '/bg2.jpg') {
		fs.readFile('./bg2.jpg', function (err, jpg) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200);
				response.write(jpg);
				response.end();
			}
		});
		
	} else if (path == '/favicon.ico') {
		fs.readFile('./favicon.ico', function (err, ico) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200);
				response.write(ico);
				response.end();
			}
		});
		
	} else if (path == '/polloallimonmolamogollon') {
		console.log('Restarting the node.');
		process.exit(0);
		
	} else {
		console.log('Room accesed: ' + path);
		fs.readFile('./client.html', function(err, html) {
			if (err) {
				response.writeHead(404);
				response.write('404 - Page not found.');
				response.end();
			}
			else {
				response.writeHead(200);
				response.write(html);
				response.end();
			}
		});
	}
}).listen(httpsport);

console.log("Web Server is listening in port " + httpsport);


// WebSockets Server

var rooms = {};

var io = require("socket.io")(httpsport);

io.sockets.on('connection', function (socket) {

	var address = socket.handshake.address.address;
	console.log((new Date()) + ' Peer connected: ' + address);
	
	socket.on('login', function(user, room) {
		
		// Check illegal character '#'
		if ((user.indexOf('#') >= 0) || (room.indexOf('#') >= 0)) {
			console.log('User or room error: illegal character \'#\'.');
			socket.disconnect();
			return;
		}
		
		if (rooms[room] === undefined) {
			rooms[room] = {'userlist' : {}, 'mod' : [user], 'ban' : [], 'mute' : [] };
			socket.emit('admin', user, 'mod');
		}
		else if (rooms[room].userlist[user] !== undefined) {
			console.log('User already exists in the room.')
			socket.disconnect();
			return;
		}
		else if (rooms[room].ban.indexOf(address) >= 0) {
			console.log(address + ' banned in room ' + room + '.');
			socket.disconnect();
			return;
		}
		
		socket.room = room;
		socket.user = user;
		
		socket.emit('userlist', Object.keys(rooms[room].userlist));
		bcast(socket, 'hello', '');
		rooms[room].userlist[user] = socket;

		socket.on('message', function(data) {
			bcast(this, 'message', data);
		});
		
		// WebRTC functions
		socket.on('offer', function (to, data) {
			send(this, 'offer', to, data);
		});
	
		socket.on('answer', function (to, data) {
			send(this, 'answer', to, data);
		});
	
		socket.on('ice', function (to, data) {
			send(this, 'ice', to, data);
		});
		
		// WebRTC stream routing request
		socket.on('route', function(to,data) {
			send(this, 'route', to, data);
		});

		// Moderation
		socket.on('admin', function(to, data) {
		
			var room = socket.room;
			var from = socket.user;
			
			if (rooms[room].userlist[to] === undefined) return;
			
			var mod = rooms[room].mod.indexOf(from) >= 0;
			var muted = rooms[room].mute.indexOf(to) >= 0;
			var address = rooms[room].userlist[to].handshake.address.address;
			
			switch (data) {
				case 'mod': if (mod && (rooms[room].mod.indexOf(to) < 0)) {
								rooms[room].mod.push(to);
								bcast_admin(socket, to, 'mod');
							}
							break;
				case 'ban': if (mod && (rooms[room].ban.indexOf(address) < 0)) {
								rooms[room].ban.push(address);
							}
				case 'kick': if (mod) {
								 rooms[room].userlist[to].emit('admin', to, 'kicked');
								 rooms[room].userlist[to].disconnect();
							 }
							 break;
				case 'unban': if (mod && (rooms[room].ban.indexOf(address) >= 0)) {
								 rooms[room].ban.splice(rooms[room].ban.indexOf(address),1);
							  }
							  break;
				case 'mute': if (mod && !muted) {
								 rooms[room].mute.push(to);
								 bcast_admin(socket, to, 'mute');
							 }
							 else if (from == to) {
								 bcast_admin(socket, to, 'mute');
							 }
							 break;
				case 'unmute': if (!unmuted && (from == to)) {
								   bcast_admin(socket, to, 'unmute');
							   }
							   else if (mod && muted) {
								   rooms[room].mute.splice(rooms[room].mute.indexOf(to), 1);
								   bcast_admin(socket, to, 'unmute');
							   }
							   break;
				default: break;
			}
		});
		
		socket.on('disconnect', function () {
		
			var room = socket.room;
			var user = socket.user;
			bcast(socket, 'bye', '');
			delete rooms[room].userlist[user];
			if (Object.keys(rooms[room].userlist).length == 0) {
				delete rooms[room];
			}
			else {
				var mod = rooms[room].mod.indexOf(user);
				if (mod > -1) rooms[room].mod.splice(mod);
			
				var muted = rooms[room].mute.indexOf(user);
				if (mod > -1) rooms[room].mute.splice(muted);
			}
		});
	});
});

// Broadcast a message
function bcast(socket, tipo, msg) {
	var room = socket.room;
	var from = socket.user;
	for (var to in rooms[room].userlist) {
		rooms[room].userlist[to].emit(tipo, from, msg);
	}

};

// Send a message
function send(socket, tipo, to, msg) {
	var room = socket.room;
	var from = socket.user;
	if (rooms[room].userlist[to] !== undefined) rooms[room].userlist[to].emit(tipo, from, msg);
};

// Admin broadcasts
function bcast_admin(socket, to, command) {
	var room = socket.room;
	var from = socket.user;
	for (var user in rooms[room].userlist) {
		rooms[room].userlist[user].emit('admin', to, command);
	}
};
