import iTwinPlugin from "@itwin/eslint-plugin";

export default [
  {
    files: ["**/*.ts"],
    ...iTwinPlugin.configs.iTwinjsRecommendedConfig,
  },
];