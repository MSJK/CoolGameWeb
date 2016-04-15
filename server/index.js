import http from 'http';
import express from 'express';
import io from 'socket.io';
import socket from './socket';

var port = process.env.PORT || 3000;

var app = express();
app.server = http.createServer(app);
app.io = io(http);

app.get('/', function (req, res) {
   res.send('<h1>Hello World!</h1>');
});

socket(app);

app.server.listen(port, function () {
   console.log('Listening on *:' + port);
});

export default app;