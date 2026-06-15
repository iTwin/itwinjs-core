const iTwinPlugin = require("@itwin/eslint-plugin");

module.exports = [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.extensionExportsConfig,
  },
  {
    // Allow @beta @extensions on new provider interfaces — the eslint-plugin rule
    // currently requires @public for @extensions symbols. A fix has been requested
    // upstream (see iTwin/eslint-plugin). Remove this override once the plugin is updated.
    files: [
      "**/ElevationProvider.ts",
      "**/GeoidProvider.ts",
      "**/LocationProvider.ts",
    ],
    rules: {
      "@itwin/public-extension-exports": "warn",
    },
  },
];