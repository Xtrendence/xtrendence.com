# ![Banner](./website/public/assets/img/Banner.png)

This is a repository containing the code for my "xtrendence.com" website. It's hosted on a Raspberry Pi, and most of the scripts in the repo are hardcoded to only work with the same folder structure and username etc.

### Ports

| Application                  | Port    |
|------------------------------|---------|
| xtrendence.com (Production)  | 80, 443 |
| xtrendence.com (Development) | 3000    |
| Lights                       | 3001    |
| Auth                         | 3002    |
| Bot                          | 3004    |
| Plutus                       | 3005    |
| Journey                      | 3006    |
| SMAHunter                    | 3007    |
| CyberChef                    | 3008    |

### Folder Structure

Static files and assets (images, stylesheets, JS, audio, video etc.) go in `public` folders.

Files for EJS go in `views` folders, where they are separated into `pages` and `partials`. `pages` are routes that can be navigated to, and contain `partials`, which include `components`, `core` and `icons`. `components` are UI elements that are used, usually, on one page. `core` components are used on every page. `icons` are SVG elements that are imported into EJS files to make the code more readable.

Helper functions are grouped together in JS files inside `utils` folders, with generalized functions going in a `utils.js` file.

The website comes with a variety of modules that are placed inside the `modules` folder. Modules that serve a singular purpose and aren't integrated with the rest of the site can be found in a `tools` folder, as they are meant to be mostly standalone applications. Services that are integrated in more areas of the site go in the root of the `modules` folder (such as `auth` and `bot`).

Since the tools are only meant to be used by one person, most of them have simple `.db`, `.cfg` or even `.txt` files to store data in (usually as JSON). If anyone clones this repo with the intention of hosting the tools, they'd have to set up a proper DB as flat files won't cut it.

### CyberChef

`website/modules/tools/cyberchef` is a fork of [gchq/CyberChef](https://github.com/gchq/cyberchef), served on port 3008 behind `/tools/cyberchef` and gated by `verifyToken` like the rest of `/tools`. The fork lives at [Xtrendence/CyberChef](https://github.com/Xtrendence/CyberChef) (`origin`), with GCHQ's repo kept as `upstream` so their changes can still be pulled in.

It differs from upstream in four ways:

**Privacy defaults.** "Update the URL when the input or recipe changes" is off, so input never lands in the address bar, browser history or session restore. Automagic detection is off, and console logging defaults to silent. The Google Analytics snippet upstream injects into its GitHub Pages build has been deleted outright.

**A Content Security Policy that enforces the offline claim.** The host sets `default-src 'self'` with no external origins allowed, so the app cannot reach a third party even if a future operation or dependency tries. This blocks the three operations that genuinely use the network, `HTTP request`, `DNS over HTTPS`, and `Show on map` (which pulls Leaflet from a CDN and map tiles from OpenStreetMap). Set `CYBERCHEF_ALLOW_NETWORK_OPS=true` to relax the policy to `https:` if those operations are needed, accepting that the app can then talk to third parties.

**No outbound links.** The Download, About / Support and last-build items have been removed from the banner, along with their modals, and links inside operation help text are unwrapped to plain text so nothing in the app points off site. The keyboard shortcut table that lived in the About / Support modal has moved into Options. To restore upstream's links, drop the `stripExternalLinks` call in `src/web/HTMLOperation.mjs`.

**A Liquid Glass theme** matching the rest of the site, on by default and toggleable from Options. Unchecking it restores the stock CyberChef layout. Fonts are bundled rather than fetched from Google Fonts, so the theme adds no external requests.

Rebuild after changing anything under `src`:

```sh
cd website/modules/tools/cyberchef && nvm use 24 && npm run build
```

The build needs Node 24, unlike the rest of the repo, which runs Node 22. The host in `server/server.mjs` is dependency free and runs on either.

### Bot Notifications

Firebase Cloud Messaging is used to send and receive notifications on the bot's mobile app. All notifications are encrypted with AES-256-CBC with a 32 byte key and IV. There is an endpoint at `/bot/fcm/:token` with the URL params `title` and `body`. Both params must be URI encoded first, then Base64 encoded. There is limited support for sending them as plaintext strings but they might not show up as intended.