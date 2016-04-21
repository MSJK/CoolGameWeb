define('game', ['templates'], function (templates) {
  var socket = null;
  var game = null;
  var player = {points: 0};

  function renderState() {
    if (game === null) {
      return false;
    }

    switch (game.state.stage) {
      default:
        return false;

      case 'waiting':
        templates.use('waiting', {playerCount: game.players});
        break;

      case 'playing':
        templates.use('store', {
          items: game.state.store,
          points: player.points,
          playerCount: game.players
        });
        break;
    }

    return true;
  }

  return {
    socket: function () {
      return socket;
    },

    state: function () {
      return game;
    },

    join: function (roomCode) {
      if (socket !== null) {
        console.error('Cannot call join when a connection already exists');
        return false;
      }

      player.points = 0;

      templates.use('joining').then(function () {
        socket = io();
        socket.on('connect', function () {
          console.log('Connected to server, joining room ' + roomCode);
          socket.emit('join game', roomCode);
        });

        socket.on('disconnect', function () {
          console.log('Disconnected from server.');
          socket = null;
          game = null;
          toastr.error('Disconnected from game.');
          templates.use('login');
        });

        socket.on('game ended', function () {
          console.log('Game ended');
          toastr.warning('The game lobby was closed.');
          socket.disconnect();
        });

        socket.on('unknown game', function (roomCode) {
          console.error('Unknown game ' + roomCode);
          socket.disconnect();
          toastr.error('Unknown game ' + roomCode);
        });

        socket.on('bad command', function (roomCode) {
          console.error('Received bad command for room ' + roomCode);
        });

        socket.on('game state', function (state) {
          console.log('Updated game state:');
          console.log(state);
          game = state;
          renderState();
        });

        socket.on('points update', function (data) {
          player.points = data.points;
          renderState();
        });

        socket.on('item bought', function (item) {
          toastr.success(item.name + ' was purchased!');
          console.log(item.name + ' has been purchased');
        });
      });

      return true;
    },

    buyItem: function (itemId) {
      if (!socket) {
        console.error('Cannot buyItem when socket is invalid');
        return false;
      }

      socket.emit('buy item', {roomCode: game.roomCode, itemId: itemId});
      return true;
    }
  }
});
