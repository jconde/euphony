# euphony
NodeJS/WebRTC Communication Portal

Euphony is a WebRTC conferencing platform for multiple rooms and users based on Node.js and AngularJS.

INSTALLATION

Copy the entire folder to your server and run "node WebRTC.js". It will start a local https server so
it may require administrator privileges. You can substitute the dummy "server.crt" and "server.key" by
your own certificates so you don't see a browser error when accessing the site.

USING EUPHONY

Just use https to access the server, let your browser enter the page even if the certificate is not
valid to access the home page. Once you are there type your nickname and the name of the room you
want to create. Other users can join your room. You can send invitations using the following format
of restful URL:

https://server/room#nick

where "server" should be substituted by the address of your server, "room" should be the name of the
room and "nick" is the nickname of the person.
