# ![Banner](./website/public/assets/img/Banner.png)

This is a repository containing the code for my "xtrendence.com" website. It's hosted on a Raspberry Pi, and most of the scripts in the repo are hardcoded to only work with the same folder structure and username etc.

### Ports

| Application                  | Port    |
|------------------------------|---------|
| xtrendence.com (Production)  | 80, 443 |
| xtrendence.com (Development) | 3000    |
| Lights                       | 3001    |
| Auth                         | 3002    |
| Finances                     | 3003    |
| Bot                          | 3004    |
| CryptoShare                  | 3190    |

### Folder Structure

Static files and assets (images, stylesheets, JS, audio, video etc.) go in `public` folders.

Files for EJS go in `views` folders, where they are separated into `pages` and `partials`. `pages` are routes that can be navigated to, and contain `partials`, which include `components`, `core` and `icons`. `components` are UI elements that are used, usually, on one page. `core` components are used on every page. `icons` are SVG elements that are imported into EJS files to make the code more readable.

Helper functions are grouped together in JS files inside `utils` folders, with generalized functions going in a `utils.js` file.

The website comes with a variety of modules that are placed inside the `modules` folder. Modules that serve a singular purpose and aren't integrated with the rest of the site can be found in a `tools` folder, as they are meant to be mostly standalone applications. Services that are integrated in more areas of the site go in the root of the `modules` folder (such as `auth` and `bot`).

Since the tools are only meant to be used by one person, most of them have simple `.db`, `.cfg` or even `.txt` files to store data in (usually as JSON). If anyone clones this repo with the intention of hosting the tools, they'd have to set up a proper DB as flat files won't cut it.