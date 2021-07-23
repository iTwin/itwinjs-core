---
publish: false
---
# NextVersion

## Build tools changes

Removed TSLint support from `@bentley/build-tools`. If you're still using it, please switch to ESLint.
Also removed legacy `.eslintrc.js` file from the same package. Instead, use `@bentley/eslint-plugin` and the `imodeljs-recommended` config included in it.
