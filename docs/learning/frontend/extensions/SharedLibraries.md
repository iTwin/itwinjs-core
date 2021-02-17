# iTwin.js Shared Libraries

An iTwin.js Shared Library is a set of JavaScript APIs that are available to use at runtime from outside of the host application on the global `window` object. The use of the shared libraries are enabled by the [@bentley/extension-webpack-tools](https://www.npmjs.com/package/@bentley/extension-webpack-tools) used to build the Extension, and the iTwin.js fork of react-scripts [@bentley/react-scripts](https://www.npmjs.com/package/@bentley/react-scripts/v/3.4.1).

The shared libraries are denoted by adding a `"imodeljsSharedLibrary": true` property in the `package.json`.

The concept of iTwin.js Shared Libraries enables the re-use of APIs/objects at runtime for both applications and Extensions to share.
