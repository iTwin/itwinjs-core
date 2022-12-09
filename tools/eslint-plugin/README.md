# @itwin/eslint-plugin

ESLint plugin with default configuration and custom rules for iTwin.js projects. For best results, use with Typescript 4.1+

## Installation

You'll first need to install [ESLint](http://eslint.org) and `@itwin/eslint-plugin`:

```json
npm i eslint --save-dev
npm i @itwin/eslint-plugin --save-dev
```

## Usage

Add `@itwin` to the plugins section of your eslint configuration and (optionally) extend one of the provided configs. You can omit the `/eslint-plugin` suffix:

```json
{
  "plugins": ["@itwin"],
  "extends": "plugin:@itwin/itwinjs-recommended"
}
```

Then configure the rules you want to override under the rules section.

```json
{
  "rules": {
    "@itwin/rule-name": "off"
  }
}
```

## Using with VSCode

VSCode has an ESLint plugin, but it has some issues with plugin resolution. In order to use this config without errors, it needs to be configured to resolve plugins relative to this package (in `.vscode/settings.json`):

```json
"eslint.options": {
  "resolvePluginsRelativeTo": "./node_modules/@itwin/eslint-plugin",
  ...
},
```

As a side effect, any additional plugins added in consumer packages won't be loaded. If you want to use another ESLint plugin, there are two options:

1. Submit a PR to add the ESLint plugin (and an accompanying optional configuration) to this package.
2. Add all the plugins used in this package along with the new one to your package's devDependencies and remove the above configuration from settings.json.

## Rules not in recommended configs

### `no-internal` - prevents use of internal/alpha APIs. Example configurations

```json
// custom config
"@itwin/no-internal": [
"error",
  {
    "tag": ["internal", "alpha", "beta"]
  }
]
```

```json
// default config
"@itwin/no-internal": "error"
// tag is set to ["internal", "alpha"] by default
```

The rule will report an error whenever you use anything marked with one of the tags configured in the `tag` option.
Allowed tags: `internal`, `alpha`, `beta`, `public`.

## Helper commands

### `no-internal-report` - Runs eslint with the `@itwin/no-internal` rule turned on ("error") using a custom formatter that summarizes the output

This can be run using `npx` or from the scripts section of `package.json`:

```json
  "scripts": {
    "no-internal-report": "no-internal-report src/**/*.ts*"
  },

```

This command forwards all arguments to eslint, so it can be further customized as needed. For example, to specify the tags for the `no-internal` rule:

```json
  "scripts": {
    "no-internal-report": "no-internal-report -rule '@itwin/no-internal: ['error', { 'tag': [ 'internal', 'alpha', 'beta' ]}]' src/**/*.ts*"
  },

```
