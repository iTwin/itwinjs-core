---
publish: false
---
# NextVersion

## ESLint plugin

The ESLint configuration was moved from `@bentley/build-tools` to a new ESLint plugin `@bentley/eslint-plugin`. The ESLint configuration in package.json should now look like:

```json
"scripts": {
  "lint": "eslint ./src/**/*.{ts,tsx} 1>&2",
},
"devDependencies": {
  "eslint": "^6.8.0",
  "bentley/eslint-plugin": "^2.6.0",
  ...
},
"eslintConfig": {
  "plugins": [
    "@bentley",
    ...
    ],
  "extends": "plugin:@bentley/imodeljs-recommended"
}
```

Alternatively, `plugin:@bentley/ui` can be used, it extends the recommended configuration with additional rules used in core ui packages. There may be more alternative configurations in the future.

The old configuration path `@bentley/build-tools/.eslintrc.js` remains in place but it's not recommended to use it.
