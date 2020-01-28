# Simple Editor App

Copyright © Bentley Systems, Incorporated. All rights reserved.

An iModel.js sample application that demonstrates opening an iModel read-write and editing its data. The data is presented using the following components:

* _Viewport_: Renders geometric data onto an HTMLCanvasElement.
* _Tree_: Displays a hierarchical view of iModel contents.
* _Property Grid_: Displays properties of selected element(s).
* _Table_: Displays element properties in a tabular format.

This app serves as a guide on how you can embed one or more of these components into your own application.
See http://imodeljs.org for comprehensive documentation on the iModel.js API and the various constructs used in this sample.

## Development Setup

Follow the [App Development Setup](../../README.md) section under Sample Interactive Apps to configure, install dependencies, build, and run the app.

## Testing

Run both e2e and unit tests with `npm test`

### End-to-end tests

You can run just end-to-end tests with `npm run test:e2e`. But it takes a while
to build and start the tests, so if want to actively change something within them,
first launch the app with `npm run test:e2e:start-app` and when it's done `npm run test:e2e:test-app`

If you want to see what tests do behind the scenes, you can launch them in non
headless mode. Edit the file in *./test/end-to-end/setupTests.ts* and add

```js
{ headless: false }
```

to puppeteer launch options. Like this

```ts
before(async () => {
  browser = await Puppeteer.launch({ headless: false });
});
```

### Unit tests

Run with `npm run test:unit`

## Purpose

The purpose of this application is to demonstrate the following:

* [Dependencies](./package.json) required for iModel.js-based frontend applications.
* [Scripts](./package.json) recommended to build and run iModel.js-based applications.
* How to set up a simple backend for
  [web](./src/backend/web/BackendServer.ts) and
  [electron](./src/backend/electron/main.ts).
* How to set up a simple [frontend for web and electron](./src/frontend/api/SimpleEditorApp.ts).
* How to [consume](./src/frontend/components/App.tsx) iModel.js React components.
* How to implement unified selection between a
  [viewport](./src/frontend/components/Viewport.tsx),
  [tree](./src/frontend/components/Tree.tsx),
  [property grid](./src/frontend/components/Properties.tsx) and a
  [table](./src/frontend/components/Table.tsx).
* How to include
  [tools](./src/frontend/components/Toolbar.tsx) in a
  [viewport](./src/frontend/components/Viewport.tsx).

## Contributing

[Contributing to iModel.js](https://github.com/imodeljs/imodeljs/blob/master/CONTRIBUTING.md)
