requirejs.config({
  baseUrl: '/scripts',
  paths: {
    'handlebars': '//cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.amd.min'
  }
});

define('main', ['templates'], function (templates) {
  console.log('Loaded main');

  var socket = io();

  var gameState = {
    stage: 'waiting',
    points: -1,
    store: [],
    clients: 0
  };

  var render = function (state) {
    switch (state.stage) {
      case 'waiting':
        templates.use('/templates/waiting.hbs', {state: state});
        break;

      case 'game':
        templates.use('/templates/game.hbs', {state: state});
        break;
    }
  };

  socket.on('player joined', function () {
    gameState.clients += 1;
    render(gameState);
  });

  socket.on('player left', function () {
    gameState.clients -= 1;
    render(gameState);
  });

  socket.on('game state', function (state) {
    gameState.stage = state.stage;
    if (state.points >= 0)
      gameState.points = state.points;
    gameState.store = state.store;
    gameState.clients = state.clients;
    render(gameState);
  });

  socket.on('item bought', function (item) {
    toastr.success(item.name + ' was bought!');
  });

  render(gameState);

  return {
    render: render,
    socket: socket
  };
});
