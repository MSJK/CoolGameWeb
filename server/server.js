var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var games = require('./game')(io);

app.use(express.static('public'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  console.log('User ' + socket.id + ' connected from ' + socket.request.connection.remoteAddress);
  socket.on('disconnect', function () {
    console.log('User ' + socket.id + ' disconnected from ' + socket.request.connection.remoteAddress);

    var game = games.getGameByHostId(socket.id);
    if (game) {
      games.destroyGame(game.roomCode);
    }
  });

  socket.on('create game', function () {
    games.createGame(socket);
  });

  socket.on('join game', function (roomCode) {
    games.joinGame(socket, roomCode);
  });

  socket.on('start game', function (roomCode) {
    games.startGame(socket, roomCode);
  });

  socket.on('buy item', function (data) {
    games.buyItem(socket, data.roomCode, data.itemId);
  });

  socket.on('add item', function (data) {
    games.addItem(socket, data.roomCode, data.item);
  });

  socket.on('remove item', function (data) {
    games.removeItem(socket, data.roomCode, data.itemId);
  });

  socket.on('add points', function (data) {
    games.addPoints(socket, data.roomCode, data.amount);
  });
});

var port = process.env.PORT || 3000;
http.listen(port, function () {
  console.log('listening on *:' + port);
});

module.exports = {
  io: io,
  http: http,
  app: app
};
