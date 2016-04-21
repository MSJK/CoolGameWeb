requirejs.config({
  baseUrl: '/scripts',
  paths: {
    'handlebars': '//cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.amd.min'
  }
});

requirejs(['polyfill', 'templates'], function (templates) {
  templates.use('login');
});
