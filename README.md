# Euphony
NodeJS/WebRTC Communication Platform

Live demo: https://euphony.herokuapp.com

Euphony is a WebRTC conferencing platform for multiple rooms and users based on Node.js and AngularJS.

INSTALLATION

Copy the entire folder to your server and run "node WebRTC.js". It will start a local HTTP server so
it may require administrator privileges. If you want to use HTTPS, you can use the commented code in "server.js" and use your own certificates. Using HTTPS has some advantages over HTTP so your browser won't ask twice for permission and Chrome will allow you to share your desktop.

USING EUPHONY

Just use your browser to access the server and type your nickname and the name of the room you want to create. Other users can join your room. You can send invitations using the following format URL:

https://server/room#nick

where "server" should be substituted by the address of your server, "room" should be the name of the
room and "nick" is the nickname of the person.
