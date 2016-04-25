var randomstring = require('randomstring');

module.exports = function (io) {
  var games = {};

  function generateRoomCode() {
    return randomstring.generate({length: 4, charset: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'});
  }

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
    for (var i = game.players.length - 1; i >= 0; --i) {
      var player = game.players[i];
      if (!io.sockets.connected[player.id]) {
        game.players.splice(i);
        removed = true;
      }
    }
  }

  function sendGameState(socket, game) {
    checkPlayers(game);

    socket.emit('game state', {
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
        var socket = io.sockets.connected[p.id];
        if (socket)
          socket.emit('points update', {
            roomCode: game.roomCode,
            points: p.points
          });
      });
      setTimeout(loop, 2 * 1000);
    };

    checkPlayers(game);
    game.players.forEach(function (p) {
      var socket = io.sockets.connected[p.id];
      if (socket)
        socket.emit('points update', {
          roomCode: game.roomCode,
          points: p.points
        });
    });

    setTimeout(loop, 2 * 1000);
  }

  function gameRoom(game) {
    return "game-" + game.roomCode;
  }

  return {
    createGame: function (host) {
      do {
        roomCode = generateRoomCode();
      }
      while (games[roomCode] !== undefined);

      var game = {
        roomCode: roomCode,
        state: {
          stage: 'waiting',
          store: []
        },
        host: host.id,
        players: []
      };

      host.join(gameRoom(game));
      games[roomCode] = game;

      console.log('Created game ' + roomCode);

      host.emit('game created', roomCode);

      return game;
    },

    destroyGame: function (roomCode) {
      if (games[roomCode] === undefined)
        return false;

      var game = games[roomCode];
      var host = io.sockets.connected[game.host];
      if (host) {
        host.emit('game ended', roomCode);
      }

      game.players.forEach(function (playerObj) {
        var player = io.sockets.connected[playerObj.id];
        if (player) {
          player.emit('game ended', roomCode);
        }
      });

      game.players = [];
      game.state.stage = 'end';

      console.log('Destroyed game ' + roomCode);

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
      sendGameState(io.to(gameRoom(game)), game);

      console.log(socket.id + ' joined ' + roomCode);

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
        console.error('cannot startGame from non-host socket ' + socket.id + ' for ' + roomCode);
        return false;
      }

      if (game.state.stage !== 'waiting') {
        socket.emit('bad command', roomCode);
        console.error('cannot startGame as ' + roomCode + ' is not in the waiting state');
        return false;
      }

      game.state.stage = 'playing';
      io.to(gameRoom(game)).emit('game started', roomCode);
      sendGameState(io.to(gameRoom(game)), game);
      createGameLoop(game);

      console.log(roomCode + ' was started');

      return true;
    },

    buyItem: function (socket, roomCode, itemId) {
      var game = getGame(roomCode);
      if (!game) {
        socket.emit('unknown game', roomCode);
        return false;
      }

      var player = game.players.find(function (p) {
        return p.id == socket.id;
      });
      if (!player) {
        socket.emit('bad command', roomCode);
        console.error(socket.id + ' was not found as a player for ' + roomCode + ', cannot buyItem');
        return false;
      }

      var item = game.state.store.find(function (i) {return i.id === itemId;});
      if (!item) {
        socket.emit('bad command', roomCode);
        console.error('Unknown item ' + itemId + ' for ' + roomCode + ', cannot buyItem')
        return false;
      }

      if (player.points >= 100) {
        player.points -= 100;
        item.pool += 100;
        if (item.pool >= item.price) {
          item.pool -= item.price;
          socket.emit('item bought', item);
          console.log('Purchased item ' + itemId + ' in game ' + game.roomCode);
        }
        else {
          console.log('Added to pool for item ' + itemId + ' in game ' + game.roomCode);
        }

        socket.emit('points update', {
          roomCode: game.roomCode,
          points: player.points
        });
        sendGameState(io.to(gameRoom(game)), game);

        return true;
      }
      else {
        return false;
      }
    },

    addItem: function (socket, roomCode, item) {
      var game = getGame(roomCode);
      if (!game) {
        socket.emit('unknown game', roomCode);
        return false;
      }

      if (game.host !== socket.id) {
        socket.emit('bad command', roomCode);
        console.error('cannot addItem from non-host socket ' + socket.id + ' for ' + roomCode);
        return false;
      }

      if (!item) {
        socket.emit('bad command', roomCode);
        console.error('No item specified when using addItem for ' + roomCode);
        return false;
      }

      var newItem = {
        id: item.id,
        name: item.name,
        pool: 0,
        price: item.price
      };

      if (!newItem.id || !newItem.name || typeof newItem.price !== 'number' ||
        game.state.store.find(function (i) {return i.id === newItem.id;})) {
        socket.emit('bad command', roomCode);
        console.error('Bad item for ' + roomCode);
        console.error(newItem);
        return false;
      }

      game.state.store.push(newItem);
      console.log('Game ' + game.roomCode + ' registered item ' + newItem.id);

      sendGameState(io.to(gameRoom(game)), game);
      return true;
    },

    removeItem: function (socket, roomCode, itemId) {
      var game = getGame(roomCode);
      if (!game) {
        socket.emit('unknown game', roomCode);
        return false;
      }

      if (game.host !== socket.id) {
        socket.emit('bad command', roomCode);
        console.error('cannot removeItem from non-host socket ' + socket.id + ' for ' + roomCode);
        return false;
      }

      var item = game.state.store.find(function (i) {return i.id === itemId;});
      if (!item) {
        socket.emit('bad command', roomCode);
        return false;
      }

      game.store.splice(game.store.indexOf(item));

      console.log('Game ' + game.roomCode + ' removed item ' + itemId);

      sendGameState(io.to(gameRoom(game)), game);
      return true;
    },

    addPoints: function (socket, roomCode, amount) {
      var game = getGame(roomCode);
      if (!game) {
        socket.emit('unknown game', roomCode);
        return false;
      }

      if (game.host !== socket.id) {
        socket.emit('bad command', roomCode);
        console.error('cannot addPoints from non-host socket ' + socket.id + ' for ' + roomCode);
        return false;
      }

      if (typeof amount !== 'number') {
        socket.emit('bad command', roomCode);
        return false;
      }

      game.players.forEach(function (p) {
        p.points += amount;
        var ps = io.sockets.connected[p.id];
        if (ps)
          ps.emit('points update', {roomCode: game.roomCode, points: p.points});
      });

      console.log('Added ' + amount + ' points to all players in ' + roomCode);
    },

    gameRoom: gameRoom,
    getGame: getGame,
    getGameByHostId: getGameByHostId
  };
};
