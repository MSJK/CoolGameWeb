var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static('public'));

var gameState = {
  stage: 'waiting',
  store: [
    {name: 'Screen Shake (2 seconds)', id: 'screen-shake', pool: 0, cost: 500},
    {name: 'Speed Up (15 seconds)', id: 'speed-up', pool: 0, cost: 1000}
  ]
};

var host = null;

function buildClientState(socket) {
  return {
    stage: gameState.stage,
    store: gameState.store,
    points: socket ? socket.session.points : -1,
    clients: Object.keys(io.sockets.sockets).length
  };
}

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  console.log('User connected from ' + socket.request.connection.remoteAddress);
  socket.on('disconnect', function () {
    console.log('User disconnected from ' + socket.request.connection.remoteAddress);
  });

  socket.session = {
    points: 0
  };

  var socketLoop = function () {
    if (!socket.connected)
      return;

    if (gameState.stage === 'game' && socket !== host) {
      socket.session.points += 20;
      socket.emit('game state', buildClientState(socket));
    }
    else {
      socket.session.points = 0;
    }

    setTimeout(socketLoop, 2 * 1000)
  };
  setTimeout(socketLoop, 2 * 1000);

  socket.on('buy item', function (id) {
    try {
      id = Number(id);
    }
    catch (e) {return;}

    if (id < 0 || id >= gameState.store.length)
      return;

    var item = gameState.store[id];

    if (socket.session.points < 100)
      return;

    socket.session.points -= 100;
    item.pool += 100;

    if (item.pool >= item.cost) {
      item.pool = item.pool - item.cost;
      io.emit('item bought', item);
    }

    socket.broadcast.emit('game state', buildClientState());
    socket.emit('game state', buildClientState(socket));
  });

  socket.on('start game', function () {
    console.log('Received start game request');
    if (gameState.stage !== 'waiting')
      return;

    host = socket;
    gameState.stage = 'game';
    io.emit('game state', buildClientState());

    console.log('Game started');
  });

  socket.emit('game state', buildClientState(socket));
});

var port = process.env.PORT || 3000;
http.listen(port, function () {
  console.log('listening on *:' + port);
});
