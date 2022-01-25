# webpack-tools-core

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

The __webpack-tools-core__ contains a set of webpack [loaders](https://webpack.js.org/concepts/loaders/) and [plugins](https://webpack.js.org/concepts/plugins/) used to build iTwin.js backend and frontends.

The main entry point for building an iTwin.js backend is the __@bentley/backend-webpack__ package and iTwin.js frontends should use __@bentley/webpack-tools__.

This package contains the following Loaders and Plugins:

## __Loaders__

| Name | Description |
| - | - |
| strip-assert-loader | Removes all uses of @itwin/core-bentley `assert()` method from the webpack bundle. |

## __Plugins__

| Name | Description |
| - | - |
| BackendDefaultsPlugin | Combines a set of Webpack plugins to use as defaults when building an iTwin.js backend.  (Used in @bentley/backend-webpack). |
| BanImportsPlugin | Bans any import that crosses the frontend/backend boundary |
| CopyBentleyStaticResourcesPlugin | Copies static resources from '@bentley' scoped packages into the output folder.  Used to copy "assets", "public" and other resource files. |
| CopyExternalsPlugin | Copies all npm packages containing an [external](https://webpack.js.org/configuration/externals/) module (and their direct dependencies) to a `node_modules` directory next to the webpack output. |
| PrettyLoggingPlugin | Formats the output messages to print better when running within Azure DevOps Pipelines.  Flags any warnings as errors when running a CI build. |
| WatchBackendPlugin | Reloads a _frontend_ anytime its corresponding backend changes. |
| IModeljsLibraryExportsPlugin | Promotes all module exports to the global scope, under a "__IMODELJS_INTERNALS_DO_NOT_USE" variable, with an "imjsSharedLib" in the `package.json`. |