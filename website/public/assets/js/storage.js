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

if (
    [undefined, null, false, 'false'].includes(
        window.localStorage.getItem('consent')
    )
) {
    const content = `
        <div class="cookie-consent">
            <h2>Cookie Policy</h2>
            <p>This website may use a combination of cookies and local storage in order to manage your login session and provide other core functionalities.</p>
            <p>Cookies and local storage are never used to track you or collect analytical data.</p>
						<div>
							<button id="cookie-reject">Reject</button>
							<button id="cookie-accept">Accept</button>
						</div>
        </div>
    `;

    const notification = Notify.info({
        content,
        duration: -1,
        width: 400,
        maxWidth: 400,
    });

    document.getElementById('cookie-reject').addEventListener('click', () => {
        notification.instance.hideNotification(notification.element);
    });

    document.getElementById('cookie-accept').addEventListener('click', () => {
        window.localStorage.setItem('consent', true);
        notification.instance.hideNotification(notification.element);
    });
}
