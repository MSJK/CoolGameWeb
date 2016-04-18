define('templates', ['handlebars'], function (handlebars) {
  var cache = {};

  var get = function (path) {
    return new Promise(function (resolve, reject) {
      if (cache[path]) {
        resolve(cache[path]);
      }
      else {
        $.get(path, function (data) {
          var compiled = handlebars.compile(data);

          cache[path] = compiled;
          resolve(compiled);
        }).fail(function () {
          reject();
        });
      }
    });
  };

  var use = function (path, data, cb, element) {
    return get(path).then(function (template) {
      var html = template(data);
      if (!element) {
        element = $('#app');
      }

      element.html(html);

      if (cb && typeof cb === 'function') {
        cb(template);
      }
    });
  };

  return {
    get: get,
    use: use
  };
});
