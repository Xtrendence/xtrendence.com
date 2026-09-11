let projects = {
  'art-website': {
    title: 'Art Website',
    description:
      'A professional art website I developed for my father. The website is responsive and limited to one page through the use of AJAX requests.',
    tags: 'php, api, custom, professional, style, client',
    status: 'Finished',
  },
  'cmc-api': {
    title: 'CoinMarketCap API',
    description:
      "A website created to track a number of cryptocurrencies and their respective prices. The website makes use of CoinMarketCap's API and updates the results at a regular interval.",
    tags: 'live, web, application, json',
    status: 'Finished',
  },
  collector: {
    title: 'Collector',
    description:
      'A website that allows users to add or remove items to a specified collection of theirs, similar to a sort of checklist. They can name the item and add an image for it. The website uses AJAX requests to function, and the images are hosted on Imgur using their API.',
    tags: 'php, json',
    status: 'Finished',
  },
  countdown: {
    title: 'Countdown',
    description:
      'A tool I developed that can create countdowns to a date specified by the user. A page is then created which the user can share or simply keep an eye on. The page includes a JavaScript timer that counts down to the date by showing the number of days, hours and seconds left until the event that the user specified.',
    tags: 'web, application',
    status: 'Finished',
  },
  cryptofolio: {
    title: 'Cryptofolio',
    description:
      "An open-source, and self-hosted solution for tracking your cryptocurrency holdings. It features a web interface, an Android mobile app, and a cross-platform desktop application for Windows, macOS, and Linux. These three platforms all work using a RESTful API, which you'd have to host yourself. Considering the nature of the project, it aims to put the user's privacy first by having no centralized server, and storing user data locally on the server hosting the API.",
    tags: 'finance, financial, blockchain, react, react native, node, js',
    status: 'Finished',
  },
  filedrop: {
    title: 'FileDrop',
    description:
      "An open-source encrypted file sharing application that leverages web sockets to allow clients to send each other files. All enryption is done on the client side, so the server doesn't need to be trusted.",
    tags: 'network, aes, aes-256, encryption, rsa',
    status: 'Finished',
  },
  'frome-maths': {
    title: 'Frome Maths',
    description:
      'A website developed by me and my friend for our year 12 work experience. It is a revision site for mathematics at Frome College. The security at the college is quite strict and as a result, no server-side programming languages were used in the development of the website. My friend wrote the HTML, I wrote the CSS.',
    tags: 'team, teamwork, working',
    status: 'Finished',
  },
  'income-tracker': {
    title: 'Income Tracker',
    description:
      'A simple income tracker made with HTML, CSS, and JavaScript on the frontend, and Node.js on the backend. It also features a chart of your performance during the current month, along with a daily average.',
    tags: 'web app, js, node, api, chart',
    status: 'Finished',
  },
  lights: {
    title: 'Lights',
    description:
      "A website along with a custom API that I developed in order to remotely control the lightbulb in my room. It can turn it on or off as well as change its color and brightness. The website also features a guest mode that anyone can use as long as they're in my house.",
    tags: 'live, application, json, light, lights, lightbulb, smart, bulb, iot',
    status: 'Finished',
  },
  'native-encryption': {
    title: 'Native Encryption',
    description:
      'A fairly simple mobile app created using React Native that allows the user to encrypt and decrypt text using AES-256. This was my first React Native project, and was just a way for me to experiment and figure out how it all works.',
    tags: 'cryptography, decryption, react.js, reactjs',
    status: 'Finished',
  },
  revision: {
    title: 'Revision',
    description:
      'A simple revision website I made for A-Level English. I shared it with classmates as well. It includes a number of poems by Seamus Heaney. The poems have been analyzed and annotated. It also includes an analysis of "A Streetcar Named Desire" and "The Great Gatsby."',
    tags: 'html, css, education, a-level, study',
    status: 'Finished',
  },
  sdlc: {
    title: 'A-Level Computer Science Project',
    description:
      'A system developed as my A-Level project with the goal of simplifying the process my customers have to go through in order to request icons for my themes. It features a working registration and login form along with a request page. It also displays statistics for the requests with a pie chart generated with PHP. It uses a MySQL database to save user information as well as any requests my clients might make.',
    tags: 'sdlc, software, development, life, cycle, documentation',
    status: 'Finished',
  },
  serenyx: {
    title: 'Serenyx',
    description:
      'A bot I developed to make my life easier. It can track cryptocurrency prices, control accessories in my house, backup my phone, define words, control my website, search for song names using lyrics, download files, check the weather and much more.',
    tags: 'ai, chat, chatbot, api, json, data, manipulation, intelligent, artificial, intelligence, talk, ajax, post, php',
    status: 'Ongoing',
  },
  'soft152-assignment': {
    title: 'SOFT152 University Assignment',
    description:
      'An Airbnb property management tool written in C# for a university assignment. It reads data from a text file, displays it in multiple ListViews where it can be modified. The modified data can then be written back to the file.',
    tags: 'streamreader, streamwriter, listbox, search, substring, responsive, oop, object-oriented programming, object oriented',
    status: 'Finished',
  },
  'x-anonymous': {
    title: 'X:/Anonymous',
    description:
      'A self-hosted Node.js and Socket.IO anonymous chatting web application that uses client-side RSA, and zero conversation content logs to deliver a secure means of communication.',
    tags: 'nodejs, node, javascript, js, encryption, chat, web, app, web app, anonymous, client',
    status: 'Finished',
  },
  'x-calendar': {
    title: 'X:/Calendar',
    description:
      'A calendar web application that uses jQuery AJAX requests to function. It uses PHP scripts on the server-side. Users can navigate through the calendar and set reminders for events on specific dates.',
    tags: 'json, array, object',
    status: 'Finished',
  },
  'x-chat': {
    title: 'X:/Chat',
    description:
      'A Node.js and Socket.IO chatting web application that uses RSA-2048, AES-256-CTR, and BCrypt to deliver a secure means of communication.',
    tags: 'nodejs, node, javascript, js, encryption, chat, web, app, web app',
    status: 'Finished',
  },
  'x-cloud': {
    title: 'X:/Cloud',
    description:
      'A cloud storage site that uses jQuery AJAX along with a PHP API on the back-end to work. It has an incredibly responsive design and a custom, efficient and fast API. The user can upload multiple files at the same time, move them, rename them, and download them.',
    tags: 'drive, live, javascript, js, mobile, web, app, web app',
    status: 'Finished',
  },
  'x-landrop': {
    title: 'X:/LANDrop',
    description:
      "A cross-platform AirDrop-like application running on Node.js (with Electron). Two or more devices running X:/LANDrop can detect each other if they're on the same network, and can securely share files with one another.",
    tags: 'network, node, javascript, js, encryption, aes, aes-256, cryptography',
    status: 'Finished',
  },
  'x-music': {
    title: 'X:/Music',
    description:
      "A Node.js (with Electron) based music player for Windows, Mac, and Linux. Users can import and listen to their existing music library, and it also has a remote control feature which allows any device on the network to control the host, or bypass the host and use it as a media server, which uses the remote's speakers as the audio output.",
    tags: 'javascript, json, web app, web, app, api, mobile, js',
    status: 'Finished',
  },
  'x-notes': {
    title: 'X:/Notes',
    description:
      'A note taking web app that utilizes a private and custom PHP API to work. All operations on the site are done on the same page using AJAX. The design is extremely responsive and well optimized.',
    tags: 'notes, live, javascript, js, mobile, web, app, web app',
    status: 'Finished',
  },
  'x-os': {
    title: 'X:/OS',
    description:
      'A cloud storage solution that simulates an operating system. It features multiple file uploads, directory nesting, drag and drop file interactions, and more. It also has a simulated file system [structure].',
    tags: 'os, live, javascript, js, mobile, web, app, web app, jquery, php, api',
    status: 'Finished',
  },
  'x-passwd': {
    title: 'X:/Passwd',
    description:
      'A password manager for Android written in Dart using the Flutter SDK. Available for purchase on the Google Play Store.',
    tags: 'published, encryption, aes, aes-256, cryptography',
    status: 'Finished',
  },
  'x-university': {
    title: 'X:/University',
    description:
      'A web-app to keep track of everything related to life while attending a university. This includes your transactions, bank balance, files, revision notes, lecture notes etc.',
    tags: 'student, api, php, javascript, jquery, education',
    status: 'Finished',
  },
};

let projectOrder = [
  'serenyx',
  'cryptofolio',
  'filedrop',
  'x-music',
  'x-os',
  'x-passwd',
  'native-encryption',
  'x-landrop',
  'x-anonymous',
  'x-chat',
  'x-notes',
  'income-tracker',
  'x-university',
  'x-cloud',
  'sdlc',
  'soft152-assignment',
  'x-calendar',
  'frome-maths',
  'collector',
  'art-website',
  'lights',
  'cmc-api',
  'revision',
  'countdown',
];

/*
 * Supplementary metadata. Kept separate from `projects` above so the original
 * titles, descriptions, tags and statuses stay untouched.
 *   repo:   GitHub repository name, if the project is published.
 *   groups: filter buckets used by the projects section.
 */
let projectMeta = {
  serenyx: { groups: ['featured', 'apps'] },
  cryptofolio: { repo: 'Cryptofolio', groups: ['featured', 'apps', 'finance', 'web'] },
  filedrop: { repo: 'FileDrop', groups: ['featured', 'security', 'web'] },
  'x-music': { repo: 'X-Music', groups: ['featured', 'apps'] },
  'x-os': { repo: 'X-OS', groups: ['featured', 'web'] },
  'x-passwd': { repo: 'X-Passwd', groups: ['featured', 'apps', 'security'] },
  'native-encryption': { repo: 'Native-Encryption', groups: ['apps', 'security'] },
  'x-landrop': { repo: 'X-LANDrop', groups: ['apps', 'security'] },
  'x-anonymous': { repo: 'X-Anonymous', groups: ['security', 'web'] },
  'x-chat': { repo: 'X-Chat', groups: ['security', 'web'] },
  'x-notes': { repo: 'X-Notes', groups: ['web'] },
  'income-tracker': { repo: 'Income-Tracker', groups: ['finance', 'web'] },
  'x-university': { repo: 'X-University', groups: ['web', 'study'] },
  'x-cloud': { groups: ['web'] },
  sdlc: { groups: ['web', 'study'] },
  'soft152-assignment': { repo: 'SOFT152-Assignment', groups: ['study'] },
  'x-calendar': { repo: 'X-Calendar', groups: ['web'] },
  'frome-maths': { groups: ['web', 'study'] },
  collector: { repo: 'Collector', groups: ['web'] },
  'art-website': { groups: ['web'] },
  lights: { repo: 'Lights', groups: ['web', 'apps'] },
  'cmc-api': { groups: ['finance', 'web'] },
  revision: { groups: ['web', 'study'] },
  countdown: { groups: ['web'] },
};

let projectFilters = [
  { id: 'all', label: 'All' },
  { id: 'featured', label: 'Featured' },
  { id: 'web', label: 'Web' },
  { id: 'apps', label: 'Mobile & Desktop' },
  { id: 'security', label: 'Security' },
  { id: 'finance', label: 'Finance' },
  { id: 'study', label: 'Academic' },
];
