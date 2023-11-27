const localStorage = window.localStorage
    ? {
          getItem: function (key) {
              return window.localStorage.getItem('consent') !== 'true'
                  ? null
                  : window.localStorage.getItem(key);
          },
          setItem: function (key, value) {
              return window.localStorage.getItem('consent') !== 'true'
                  ? null
                  : window.localStorage.setItem(key, value);
          },
          removeItem: function (key) {
              return window.localStorage.getItem('consent') !== 'true'
                  ? null
                  : window.localStorage.removeItem(key);
          },
          clear: function () {
              return window.localStorage.getItem('consent') !== 'true'
                  ? null
                  : window.localStorage.clear();
          },
          length: function () {
              return window.localStorage.getItem('consent') !== 'true'
                  ? 0
                  : window.localStorage.length;
          },
          key: function (index) {
              return window.localStorage.getItem('consent') !== 'true'
                  ? null
                  : window.localStorage.key(index);
          },
      }
    : {
          getItem: function () {
              return null;
          },
          setItem: function () {
              return null;
          },
          removeItem: function () {
              return null;
          },
          clear: function () {
              return null;
          },
          length: function () {
              return 0;
          },
          key: function () {
              return null;
          },
      };
