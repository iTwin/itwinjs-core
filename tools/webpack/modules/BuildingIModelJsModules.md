# Building iModel.js Modules

This article describes the tools provided by iModel.js to build frontend modules. In this context, frontend modules are JavaScript files (transpiled and webpacked from TypeScript source files) that are intended to run in either a browser or in an Electron application. Some background on iModel.js modules is provided in [Modularizing iModel.js](ModularizingIModelJs.md).

## Types of Modules

There are three types of modules in the iModel.js frontend ecosystem :

1. System modules. The iModel.js frontend system is composed of a set of modules that perform functions such as geometry calculations, user interface customization, and coordinating remote procedure calls to iModel.js backend functions. Each such module is built using the technique described here.

2. Application modules. An iModel.js application consists of a module that contains the code for its unique functionality, with calls into the iModel.js system modules that take advantage of the classes and methods provided by iModel.js. An application module is loaded by the browser (or Electron) at startup.

3. SubModules. A submodule is a module whose source is in the same package as the main module. Most submodules are plugins, which are designed to be loaded into an iModel.js application in a browser or Electron application while it is already executing. The Plugin registers with the iModel.js system, and then has full access to the iModel.js API. A Plugin can be used in multiple iModel.js applications. See the [iModel.js Plugins](../../../docs/learning/Plugins.md) article for more information. Another type of submodule is a webworker, which are used to offload work from the javascript thread to a worker thread.

## Copying vs Symlinking

Applications need files that are built in other packages, including external modules, localization files, cursors, fonts, and other assets. These other files can be either copied or symlinked into the application's webresources directory. The default is to copy those files. However, if you are working on files within the iModel.js mono repository, symlinking is much better because you don't have to remember to rebuild the application after changing one of the modules that it uses. To use symolinking, set the configuration variable BUILDIMODEL_SYMLINKS to any value. 

## Building a Module

All three types of modules are built using the buildIModelJsModule script. The package.json file for your module is used to invoke the buildIModelJsModule script and to configure its operation.

## Invoking the buildIModelJsModule script

As you are already aware, your package.json file includes a "scripts" property that is used by the "npm run" command to select a script. The "scripts" property is an object whose properties are the short names of the scripts, each of which has a value that is the actual command that npm launches. To use the buildIModelJsBuild.js script, the "@bentley/webpack-tools" package is included in the "devDependencies" property, and "buildIModelJsModule" is the value of the "build" property. For example:

```json
{
  "name": "your-app",
  ...
  "scripts": {
    "build": "buildIModelJsModule",
    ...
  },
  ...
  "devDependencies": {
    "@bentley/webpack-tools": "0.189.0-dev.16",
    ...
  },
...
}
```

When you run the "npm install" command, it puts two files, "buildIModelJsConfig" and "buildIModelJsConfig.cmd" in the package's node_modules/.bin directory. That is where npm finds it. To invoke the buildIModelJsModule script to build your module, use the shell command:

```shell
npm run build
```

Note:

For modules that are in the iModel.js rush repository, using "buildIModelJsModule" alone will not work, because rush's symbolic linking mechanism doesn't put the "./bin" scripts from within the mono repository into the common/temp/node_modules/.bin directory. So the correct build entry for modules within that mono repository is:

```json
    "build": "node ./node_modules/@bentley/webpack-tools/bin/buildIModelJsModule.js"
```

In that case, you use "rush build" as you would expect.

## Module Build Steps

There are several steps in building a module, which are sequenced by the buildIModelJsModule script:

1. Transpiling the TypeScript source code to JavaScript. Generally, TypeScript files in the "src" directory are transpiled into a parallel "lib" directory.
2. Copying any resources that are needed by the webpack step into the "lib" directory structure. Examples include style sheets, svg files, etc.
3. Webpacking the module.
4. For application modules, copying the external modules required into the directory from which the web server delivers files in response to HTTP requests.
5. For applications, building any Plugins or other submodules that are in the same package as the main application.
6. For Bentley applications only, creating the configuration file that accompanies the system modules.
7. For application localization testing, create pseudo-localized files to make it easy to spot strings that are not localizable.

Not all steps are required by every module. In particular, application modules are more complicated, and they are usually the only ones that require the last four steps.

## Package.json properties that control the module build

The build is controlled by the contents of an iModelJs.buildModule property in package.json. That property is an object with one required property and a number of optional properties.

The required property is type, and it must have a string containing "application", "system", "plugin", or "webworker". Here is an example of the start of an iModel.js module build specification in package.json:

```json
{
  ...
  "iModelJs": {
    "buildModule": {
      "type": "application",
      ...
    }
  }
  ...
}
```

### Transpiling TypeScript files

The buildIModelJsModule script always attempts to transpile the typescript files in your project using the "tsc" command. The version of the TypeScript transpiler is defined by the "typescript" property in the "devDependencies" property of your package.json. Bentley recommends that you use the same version of TypeScript as is used by the iModel.js system modules. Generally, the files that are transpiled and the transpiler options are defined in a file called tsconfig.json in the root directory of your package (the directory where package.json resides). Bentley recommends that you examine the tsconfig.cfg files that are used for the iModel.js system modules and adopt the same pattern. To use the same transpile options that iModel.js uses, make an "extends" property in your tsconfig.json and set it to "../node_modules/@bentley/build-tools/tsconfig-base.json".

```json
tsconfig.json

{
  "extends": "../node_modules/@bentley/build-tools/tsconfig-base.json",
  ...
}
```

You can specify arguments to the "tsc" command by adding a "tscOptions" property. For example:

```json
package.json

{
  ...
  "iModelJs": {
    "buildModule": {
      ...
      "tscOptions": "-b ./src/test",
      ...
      }
    }
  },
  ...
}
```

could be used to specify that you want to compile the TypeScript ./src/test/tsconfig/json build project. Usually, all the options to the TypeScript transpiler are contained in tsconfig.json, and the tscOption option is not needed.

### Copying Source Resources

Frequently, some files from the source directory will have to be placed into the directory where the transpiled JavaScript files reside so that webpack can find them in the same relative path. For applications, files may need to be copied from source directories to the directory where web resources are staged. The "sourceResources" property specifies the source and destination for those files, which are symbolically linked from the source to the destination. The "sourceResources" property is an array of objects, each of which has a "source" and "dest" property. For example:

```json
  "iModelJs": {
    "buildModule": {
      "type": "application",
      "sourceResources": [
        {
          "source": "./src/**/*.scss",
          "dest": "./lib"
        },
        {
          "source": "./public/**/*",
          "dest": "./lib/webresources"
        }
     ],
     ...
    }
  },
```

This copies or symlinks all the .scss files in all subdirectories of the src directory to parallel directories in the lib directory, and copies or symlinks all of the files in all subdirectories of the public directory into the lib/webresources directory. In some cases, you might prefer that the resources be copied rather than linked. In that case, add a boolean "copy" property alongside the "source" and "dest" properties and set it to true. If the resource specified with a "copy" property would also be copied by a sourceResources entry with a glob specification, make sure it appears earlier in the array of sourceResources.

### Webpacking

Webpacking consolidates the source files that make up a module into a single file and generates the code necessary to import symbols from external modules. Webpacking has a confusing array of options that control how the code is generated, but the buildIModelJsModule script configures all of those for you. All you have to provide a "webpack" property that specifies the entry point for your module, where the output is to be put, and the name of the bundle created by webpack. For applications, the bundleName should always be "main". For system modules, bundleName matches the name of the "barrel" file that consolidates the imports for the module. The bundleName for plugins should be something descriptive. For example:

```json
   "iModelJs": {
    "buildModule": {
      "type": "application",
      ...
      "webpack": {
        "entry": "./lib/frontend/index.js",
        "dest": "./lib/webresources",
        "bundleName": "main",
        "styleSheets": true,
        "htmlTemplate": "./src/frontend/index.html"
      },
    ...
    }
   }
```

In this case, there are two optional properties.  "styleSheets" is a boolean property that is usable for all module types. If true, it indicates that webpack should add processing for .scss files.  "htmlTemplate" is a property used only by application modules. It must point to the source for an html template file that is processed by webpack to encode the system modules required for the application and their versions (information that is used at runtime to load those system modules). For example, here is a typical index.html file:

```html
index.html

<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta name="theme-color" content="#000000">
  <link rel="shortcut icon" href="favicon.ico">
  <link rel="manifest" href="manifest.json">
  <link href="themes.css" rel="stylesheet" type="text/css" media="all">
  <title>iModel.js Application</title>
  <style>
    html,
    body {
      height: 100%;
      width: 100%;
      margin: 0;
    }

    #root {
      height: 100%;
    }
  </style>
  <!-- use the webpack-generated runtime.js to get our modules to share dependencies. -->
  <script type="text/javascript" src="runtime.js"></script>
  <!-- Use the IModelJs loader to load the system modules in the correct order -->
  <!-- The lodash template in the next line is replaced by webpack with the name and versions of imodeljs frontend packages -->
  <script type="text/javascript" src="IModelJsLoader.js" data-imjsversions= '<%= htmlWebpackPlugin.options.imjsVersions %>'></script>
</head>

<body>
  <noscript>
    You need to enable JavaScript to run this app.
  </noscript>
  <div id="root"></div>
  <!--
      This HTML file is a template.
      If you open it directly in the browser, you will see an empty page.
    -->
</body>

</html>
```

As you can see from the comments in the file, the script tag that invokes IModelJsLoader contains a template that is replaced by webpack with a list of iModel.js system modules that are needed and their versions.

### Copying External Modules to the Web resources directory

For application modules only, buildIModelJsModule symbolic links all the external modules that are needed into the "dest" directory of the webpack property. No further buildModule properties are needed for this step.

### Building Submodules in the same package

Sometimes, it might be desirable to put certain submodules, such as Plugins or Webworkers, in the same package as the application itself. The buildImodelJsModule script addresses this requirement through the use of a subModules property. It is an array of objects, each of which has "dest", "entry",  and "bundleName" properties. Optionally, there can be a "type" property that can have the value "plugin" (the default), "webworker", or "system". Another optional property, "styleSheets", can appear as in the "webpack" property above. For example, the following plugins property specifies that a MeasurePoints plugin is built alongside the application.

```json
  "iModelJs": {
    "buildModule": {
      "type": "application",
      ...
      "plugins": [
        {
          "dest": "./lib/webresources",
          "entry": "./lib/frontend/plugins/MeasurePoints.js",
          "bundleName": "MeasurePoints",
          "type": "plugin"
        }
      ],
      ...
    }
  },
  ...
```

### Creating a Configuration file

For Bentley applications only, the "makeConfig" property is specified to create a config.json file that configures the server with the variables specified in the unpublished @bentley/imodeljs-config package. See examples in the rush repository for usage.

### PseudoLocalizing json locale files

For localization, iModel.js uses the popular i18next package. Localizable strings are defined in json files where the keys are the property names and the localizable strings are the values. See [Localization in iModel.js](../../docs/learning/core/frontend/Localization.md) for an explanation. While an application is under development, it is useful to be able to easily tell whether a string that appears in the user interface has been properly set up for localization before sending the localization json files out for translation. A way of doing that while somewhat preserving readability of the UI is called pseudoLocalization. In that process, a separate locale, "en-pseudo" is created and all the vowels in the original strings are replaced with various accented variations. The buildIModelJsModule script will perform that step if a "pseudoLocalize" property is provided. It should be an object with a "source" and "dest" property. For example:

```html
  "iModelJs": {
    "buildModule": {
      "type": "application",
      ...
      "pseudoLocalize": {
        "source": "./lib/webresources/locales/en",
        "dest": "./lib/webresources/locales/en-pseudo"
      },
      ...
    }
  },
```

tells the script to process all of the source files in the ./lib/webresources/locales/en directory and put the output files into ./lib/webresource/locales/en-pseudo. Generally, the "pseudoLocalize" property makes sense only for application and plugin modules.

## Passing Arguments to buildIModelJsModule

The buildIModelJsModule script takes these arguments

```shell
Options:
  --version                 Show version number                                                  [boolean]
  --production, --prod, -p  Build production version of module                                   [boolean]
  --verbose, -v             Show detail level 1                                                  [boolean]
  --detail, -d              Sets detail level (0 to 4) to reveal more about the build process    [number]
  --stats, -s               Creates the webpack stats json file for system modules               [boolean]
  --help                    Show help                                                            [boolean]
```

Most of these options are self-explanatory. The "--production" argument tells the build script to create the production build of the module. The differences between a production build and the development build (which is the default) arise during the webpack step. Production builds are minified (eliminating comments and carriage returns, shortening variable names, etc.) and all the calls to the assert function imported from @bentleyjs-core are eliminated. Development builds of system modules are put into the "dev" subdirectory of the designated "dest" directory, while production builds are put into the "prod" subdirectory. Builds of application modules copy or symlink the required system modules from the appropriate subdirectory based on build type.

The "--detail" argument requires a number between 0 and 4, (e.g., --detail=2). Detail level 1 logs the start and end of each build step (although the output can be a little confusing because some steps are executed in parallel). Detail level 2 additionally shows the output of the webpack process, detail level 3 adds a report of skipped steps, and detail level 4 shows substeps such as the copying or symlinking of individual files. Errors are always displayed, and cause the process exit code to be non-zero.

The "--stats" argument affects the webpack step by passing the "--json" argument to it and directing webpack's output to a file called "webpackStats.json" in the same directory as the module. That can be useful for analyzing the packages used by the module as well as other webpack performance information. A downside to using that argument is that webpack also directs all errors to the webpackStats.json file, so if you encounter a webpack error with the --stats argument, look in webpackStat.json to get more information about the error.

For packages that are not in the iModel.js mono repository, the build command is generally invoked using the "npm run build" command. To pass arguments to the script that npm invokes rather than to npm inself, you must put in a "separator" argument, "--" before the arguments that should be passed to the builIModelJsModule script. For example, to build a production version and show detail level 1, you would use this command:

```shell
npm run build -- --production --detail=1
```

For packages that are in the iModel.js rush mono repository, the build process is sequenced by the "rush build" command. In that case, the command line options that can be passed to the build command are determined by the rush configuration file "command-line.json". There are some restrictions in how the arguments can be structured, and arguments cannot be used that conflict with those that are processed by rush itself. That means that you must spell out the full "--production" argument rather than using the "-p" shortcut. To see the arguments using rush, execute "rush build --help", and this message is displayed:

```shell
Found configuration in D:\bentleyjs\imodeljs\rush.json


Rush Multi-Project Build Tool 5.5.4 - https://rushjs.io

Found configuration in D:\bentleyjs\imodeljs\rush.json

usage: rush build [-h] [-p COUNT] [-t PROJECT1]
                  [--to-version-policy VERSION_POLICY_NAME] [-f PROJECT2] [-v]
                  [-o] [--production] [-s] [-d {0,1,2,3,4}]


This command is similar to "rush rebuild", except that "rush build" performs
an incremental build. In other words, it only builds projects whose source
files have changed since the last successful build. The analysis requires a
Git working tree, and only considers source files that are tracked by Git and
whose path is under the project folder. (For more details about this
algorithm, see the documentation for the "package-deps-hash" NPM package.)
The incremental build state is tracked in a file "package-deps.json" which
should NOT be added to Git. The build command is tracked by the "arguments"
field in this JSON file; a full rebuild is forced whenever the command has
changed (e.g. "--production" or not).

Optional arguments:
  -h, --help            Show this help message and exit.
  -p COUNT, --parallelism COUNT
                        Specify the number of concurrent build processes The
                        value "max" can be specified to indicate the number
                        of CPU cores. If this parameter omitted, the default
                        value depends on the operating system and number of
                        CPU cores.
  -t PROJECT1, --to PROJECT1
                        Run command in the specified project and all of its
                        dependencies
  --to-version-policy VERSION_POLICY_NAME
                        Run command in all projects with the specified
                        version policy and all of their dependencies
  -f PROJECT2, --from PROJECT2
                        Run command in all projects that directly or
                        indirectly depend on the specified project
  -v, --verbose         Display the logs during the build, rather than just
                        displaying the build status summary
  -o, --changed-projects-only
                        If specified, the incremental build will only rebuild
                        projects that have changed, but not any projects that
                        directly or indirectly depend on the changed package.
  --production          Sets production build for iModelJs modules
  -s, --stats           Stores the webpack json stats for iModelJs system
                        modules
  -d {0,1,2,3,4}, --detail {0,1,2,3,4}
                        Selects the level of output when building iModelJs
                        modules. The default value is "0".
```
