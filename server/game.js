var randomstring = require('randomstring');
var server = require('./server');

var games = {};

function getGame(roomCode) {
  return games[roomCode];
}

function getGameByHostId(hostId) {
  for (var key in games) {
    if (!games.hasOwnProperty(key))
      continue;

    var game = getGame(key);
    if (game && game.host === hostId)
      return game;
  }

  return undefined;
}

function checkPlayers(game) {
  var removed = false;
  for (var i = game.players.length = 1; i >= 0; --i) {
    var player = game.players[i];
    if (!server.io.sockets.connected[player.id]) {
      game.players.splice(i);
      removed = true;
    }
  }
}

function sendGameState(socket, game) {
  checkPlayers(game);

  socket.emit({
    players: game.players.length,
    roomCode: game.roomCode,
    state: game.state
  });
}

function createGameLoop(game) {
  var loop = function () {
    if (game.state.stage !== 'playing')
      return;

    game.players.forEach(function (p) {
      p.points += 20;
      var socket = server.io.sockets.connected[p.id];
      if (socket)
        socket.emit('points update', {
          roomCode: game.roomCode,
          points: p.points
        });
    });
    setTimeout(loop, 2 * 1000);
  };
  setTimeout(loop, 2 * 1000);
}

function gameRoom(game) {
  return "game-" + game.roomCode;
}

module.exports = {
  createGame: function (host) {
    var roomCode = randomstring.generate({length: 4, charset: 'alphanumeric', capitalization: 'uppercase'});
    while (games[roomCode] !== undefined) {
      roomCode = randomstring.generate({length: 4, charset: 'alphanumeric', capitalization: 'uppercase'});
    }

    var game = {
      roomCode: roomCode,
      state: {
        stage: 'waiting',
        store: {}
      },
      host: host.id,
      players: []
    };

    host.join(gameRoom(game));
    games[roomCode] = game;

    host.emit('game created', roomCode);

    return game;
  },

  destroyGame: function (roomCode) {
    if (games[roomCode] === undefined)
      return false;

    var game = games[roomCode];
    var host = server.io.sockets.connected[game.host];
    if (host) {
      host.emit('game ended', roomCode);
    }

    game.players.forEach(function (playerObj) {
      var player = server.io.sockets.connected[playerObj.id];
      if (player) {
        player.emit('game ended', roomCode);
      }
    });

    game.players = [];
    game.state.stage = 'end';

    delete games[roomCode];
  },

  joinGame: function (socket, roomCode) {
    var game = getGame(roomCode);
    if (!game) {
      socket.emit('unknown game', roomCode);
      return false;
    }

    var player = {
      id: socket.id,
      points: 0
    };
    game.players.push(player);
    socket.join(gameRoom(game));

    socket.emit('joined game', roomCode);
    sendGameState(socket.io.to(gameRoom(game)));
    return true;
  },

  startGame: function (socket, roomCode) {
    var game = getGame(roomCode);
    if (!game) {
      socket.emit('unknown game', roomCode);
      return false;
    }

    if (socket.id !== game.host) {
      socket.emit('bad command', roomCode);
      return false;
    }

    if (game.state.stage !== 'waiting') {
      socket.emit('bad command', roomCode);
      return false;
    }

    game.state.stage = 'playing';
    server.io.to(gameRoom(game)).emit('game started', roomCode);
    sendGameState(server.io.to(gameRoom(game)), game);
    createGameLoop(game);

    return true;
  },

  buyItem: function (socket, roomCode, itemId) {
    var game = getGame(roomCode);
    if (!game) {
      socket.emit('unknown game', roomCode);
      return false;
    }

    var player = game.players.find(function (p) {return p.id == socket.id;});
    if (!player) {
      socket.emit('bad command', roomCode);
      return false;
    }

    var item = game.state.store[itemId];
    if (!item) {
      socket.emit('bad command', roomCode);
      return false;
    }

    if (player.points >= 100) {
      player.points -= 100;
      item.pool += 100;
      if (item.pool >= item.cost) {
        item.pool -= item.cost;
        socket.emit('item bought', itemId);
      }

      sendGameState(server.io.to(gameRoom(game)), game);
      return true;
    }
    else {
      return false;
    }
  },

  gameRoom: gameRoom,
  getGame: getGame,
  getGameByHostId: getGameByHostId
};
