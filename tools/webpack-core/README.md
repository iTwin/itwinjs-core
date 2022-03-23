# @itwin/core-webpack-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

The **core-webpack-tools** package contains a set of webpack [loaders](https://webpack.js.org/concepts/loaders/) and [plugins](https://webpack.js.org/concepts/plugins/) used to build iTwin.js backend and frontends.

The main entry point for building an iTwin.js backend is the **@itwin/backend-webpack-tools** package\*\*.

This package contains the following Loaders and Plugins:

## **Loaders**

| Name                | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| strip-assert-loader | Removes all uses of @itwin/core-bentley `assert()` method from the webpack bundle. |

## **Plugins**

| Name                             | Description                                                                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BackendDefaultsPlugin            | Combines a set of Webpack plugins to use as defaults when building an iTwin.js backend. (Used in `@itwin/backend-webpack-tools`).                                                                  |
| BanImportsPlugin                 | Bans any import that crosses the frontend/backend boundary                                                                                                                                         |
| CopyBentleyStaticResourcesPlugin | Copies static resources from `@bentley` and `itwin` scoped packages into the output folder. Used to copy "assets", "public" and other resource files.                                              |
| CopyExternalsPlugin              | Copies all npm packages containing an [external](https://webpack.js.org/configuration/externals/) module (and their direct dependencies) to a `node_modules` directory next to the webpack output. |
| PrettyLoggingPlugin              | Formats the output messages to print better when running within Azure DevOps Pipelines. Flags any warnings as errors when running a CI build.                                                      |
| WatchBackendPlugin               | Reloads a _frontend_ anytime its corresponding backend changes.                                                                                                                                    |
