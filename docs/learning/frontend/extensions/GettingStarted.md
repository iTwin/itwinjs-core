# Getting Started

This tutorial will walk through creating an Extension that pops up a standard [alert](https://developer.mozilla.org/docs/Web/API/Window/alert) window using a localizable string of "Hello World".

In order to get started, create a new folder to contain the Extension.

> All the source code for this tutorial is available on [GitHub](https://github.com/imodeljs/extension-sample).

## Setup the Extension package.json

All Extensions rely on npm packages to pull in the necessary dependencies, making the first step creating a package.json.

Create the package.json by running, in the folder created above,

> To skip the walk-through of setting up the package.json, download the file [here](https://raw.githubusercontent.com/imodeljs/extension-sample/master/package.json). Then proceed to [Create the Extension Class](#create-the-extension-class).

```sh
npm init --yes
```

Next, add the required dependencies for an Extension,

```json
"devDependencies": {
  "@bentley/build-tools": "^2.0.0",
  "@bentley/extension-webpack-tools": "^2.0.0",
  "typescript": "~3.7.4"
},
"dependencies": {
  "@bentley/bentleyjs-core": "^2.0.0",
  "@bentley/geometry-core": "^2.0.0",
  "@bentley/imodeljs-common": "^2.0.0",
  "@bentley/imodeljs-i18n": "^2.0.0",
  "@bentley/imodeljs-frontend": "^2.0.0",
  "@bentley/imodeljs-quantity": "^2.0.0",
  "@bentley/product-settings-client": "^2.0.0",
  "@bentley/orbitgt-core": "^2.0.0",
  "@bentley/ui-abstract": "^2.0.0",
  "@bentley/webgl-compatibility": "^2.0.0"
}
```

Since the Extension will be written using Typescript, a basic tsconfig.json file needs to be setup. Create a new `tsconfig.json` file next to the `package.json` with the following contents, or download the file from [here](https://raw.githubusercontent.com/imodeljs/extension-sample/master/tsconfig.json).

```json
{
  "extends": "./node_modules/@bentley/build-tools/tsconfig-base.json",
  "compilerOptions": {
    "outDir": "./lib"
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx"
  ]
}
```

The final setup step is to add a basic [npm script](https://docs.npmjs.com/misc/scripts) to build the Extension. The example below is split into two different scripts. One for building the typescript and the second webpack the Extension into the correct bundle.  Copy this into the "scripts" section of the `package.json`,

```json
"build": "tsc 1>&2 && npm run build:extension",
"build:extension": "extension-webpack-tools build -s ./src/MyExtension.ts -o ./lib/extension",
```

Great! Now we're setup to start writing the Extension.

## Create the Extension Class

Now that the setup is out of the way, the next step is to create a sub-class of the [Extension]($frontend) class.

In a `MyExtension.ts` file located at in the `src` directory, add the following contents, or download the finished file [here](https://github.com/imodeljs/extension-sample/blob/master/src/MyExtension.ts),

```ts
export class MyExtension extends Extension {
  // Override the _defaultNs to setup a namespace.
  protected _defaultNs = "sample";

  /** Invoked the first time this extension is loaded. */
  public async onLoad(): Promise<void> {
    // Wait for the localization to be loaded
    await this.i18n.getNamespace(this._defaultNs)!.readFinished;

    // Add your initialization code here
    alert(this.i18n.translate(`${this._defaultNs}:Hello`));
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(): Promise<void> {
    alert(this.i18n.translate(`${this._defaultNs}:HelloAgain`));
  }
}
```

The above code creates the `MyExtension` class, initializes the localization namespace of the Extension and implements the required methods by the abstract `Extension` class.

The contents of the `onLoad` and `onExecute` methods are the main areas of an Extension.

The next step is to register the Extension with the IModelApp by adding the following line after the `MyExtension` class,

```ts
IModelApp.extensionAdmin.register(new MyExtension("sample"));
```

The `register` method is required in order for IModelApp to know that the Extension exists and can be loaded.

## Adding localization file

The final step before building and loading the extension is setting up the localization file used for the `Hello` and `HelloAgain` keys above.

## Next Steps

- The [Overview of Building an Extension](./BuildingAnExtension) backs up to to the beginning to explain, in more detail, the steps above and the overall architecture of an Extension.
- Learn how to [add UI](../../ui/augmentingui) to an iTwin.js app from Extension.
- Explore the full [iTwin.js APIs](https://www.itwinjs.org/reference/) to see what else is possible within an Extension.
