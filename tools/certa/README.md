# Certa

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

__Certa__ is a tool for easily running [mocha](https://mochajs.org/) tests in different environments.
With Certa, you can run the exact same tests in chrome, electron, and node.

The following types of tests are supported:

- Frontend-only unit tests
- Integration tests with a local backend
- Integration tests with a remote (deployed) backend

## Getting Started

There are two steps to running tests with Certa:

1. **Bundle your tests.** Depending on your project configuration, this can be as easy as running `webpack`.
2. **Choose a test runner.** This determines which environment tests will run in.

Assuming your bundled tests are located at `lib/bundled-tests.js`, you can run chrome tests on the command line via:

```sh
certa --testBundle lib/bundled-tests.js --runner chrome
```

### Configuration

Certa supports a number of other options that let you configure mocha settings, ports used for debugging, etc.
The easiest way to configure Certa is by creating a `certa.json` config file. Here's an example configuration:

```json
{
  // Comments are allowed here!
  "testBundle": "./lib/bundled-tests.js",
  "instrumentedTestBundle": "./lib/bundled-tests.instrumented.js",
  "ports": {
    "debugging": 5858,
    "frontendDebugging": 9223
  },
  "mochaOptions": {
    "timeout": 2000
  }
}
```

> By default, Certa will look for a `certa.json` file in the current working directory,
> but you can override this via the `--config` command-line option.

#### JSON Schema

Certa also includes a JSON schema to help with editing these configuration files.
You can configure VS Code to use this schema to provide intellisense (and allow comments) by adding the following to your workspace settings:

```json
  "files.associations": {
    "certa.json": "jsonc"
  },
  "json.schemas": [
    {
      "fileMatch": [ "certa.json" ],
      "url": "./node_modules/@bentley/certa/certa.schema.json"
    },
  ],
```

## How it Works

In order to work in both browser and node environments, Certa requires tests to be bundled into a single JavaScript file.
You can use a module bundler like [webpack](https://webpack.js.org/) or [rollup](https://rollupjs.org) to create this bundle.
See [below](#Bundling-Tests) for an example webpack configuration.

In addition to specifying a `testBundle`, you'll also need to choose which environment your tests should run in by specifying a _test runner_.
Certa currently includes test runners for electron, chrome, and node, but more may be added in the future.

### Child Processes

In order to realistically simulate web and desktop environments, Certa test runners may spawn a number of child processes.
The following diagram shows a simplified process tree for each test runner:

```
          ELECTRON           ┊           CHROME            ┊            NODE
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┼┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
      ┌───────────────┐      ┊                             ┊
      │ certa  <args> │      ┊                             ┊
      └───────────────┘      ┊      ╔═══════════════╗      ┊
              │              ┊      ║ certa  <args> ║      ┊
              ▼              ┊      ╚═══════════════╝      ┊    ┏━━━━━━━━━━━━━━━━━━━┓
     ╔═════════════════╗     ┊          ╱       ╲          ┊    ┃ ╔═══════════════╗ ┃
     ║ electron (main) ║     ┊         ╱         ╲         ┊    ┃ ║ certa  <args> ║ ┃
     ╚═════════════════╝     ┊  ┌─────────┐   ┏━━━━━━━━━┓  ┊    ┃ ╚═══════════════╝ ┃
              │              ┊  │ express │   ┃ chrome* ┃  ┊    ┗━━━━━━━━━━━━━━━━━━━┛
              ▼              ┊  └─────────┘   ┗━━━━━━━━━┛  ┊
   ┏━━━━━━━━━━━━━━━━━━━━━┓   ┊                             ┊
   ┃ electron (renderer) ┃   ┊                             ┊
   ┗━━━━━━━━━━━━━━━━━━━━━┛   ┊                             ┊
                             ┊                             ┊
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
                         🞑 = Frontend    ⧈ = Backend    □ = Other
```

> *Chrome technically spawns many child processes of its own, but since we're using Puppeteer to automate chrome,
> this can be considered an implementation detail.

Note that each test runner designates a single **frontend** and **backend** process (for the node test runner,
there is only one process which serves as _both_ frontend and backend). Tests are ***always*** executed in the **frontend** process.

### Local Integration Tests

You can use the optional `backendInitModule` setting to specify a CommonJs module that should be `require`d in Certa's **backend**
process _before_ executing tests. For example, you can define a local express server that will handle API requests made by your tests.
Alternatively, (with the electron test runner), you can use this to handle IPC messages in the electron main process.

## Measuring Code Coverage

Certa makes measuring code coverage super easy! Just use the `--cover` CLI option, and Certa will automatically use
[nyc](https://github.com/istanbuljs/nyc#nyc) to create a single combined report showing both backend and frontend coverage.
Any nyc settings in `package.json` or `.nycrc` will be honored.

> **NB:** Code coverage is currently only supported by the **chrome** and **node** test runners.
>
> Also, when using the chrome test runner, your bundled frontend code must be pre-instrumented.
> We recommend using [istanbul-instrumenter-loader](https://github.com/webpack-contrib/istanbul-instrumenter-loader) for this.

## Debugging Certa Tests with VS Code

The following is an example VS Code `launch.json` for debugging Certa tests:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Certa Tests (backend)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/@bentley/certa/bin/certa",
      "args": [ "--debug", "-r", "${input:integrationTestEnvironment}" ],
      "outputCapture": "std", // Needed to correctly print test results to Debug Console
      "port": 5858 // Must match ports.debugging in certa.json
    },
    {
      "name": "Certa Tests (frontend)",
      "type": "chrome",
      "request": "attach",
      "port": 9223, // Must match ports.frontendDebugging in certa.json
    },
  ],
  "compounds": [
    {
      "name": "Certa Tests",
      "configurations": [
        "Certa Tests (frontend)",
        "Certa Tests (backend)"
      ]
    }
  ],
  "inputs": [
    {
      "id": "integrationTestEnvironment",
      "description": "Select integration test frontend environment",
      "type": "pickString",
      "options": [ "chrome", "electron", "node" ]
    }
  ]
}
```

> **NB:** This configuration assumes that `${workspaceFolder}/certa.json` exists and defines a valid `testBundle` path.

With this config, you can set breakpoints in both your test backend (if a `backendInitModule` was specified in certa.json) and frontend (tests).
When you launch "Certa Tests", VS Code will prompt you to choose an environment, then start[multi-target debugging](https://code.visualstudio.com/docs/editor/debugging#_multitarget-debugging).

Note that the frontend debugger will always fail to attach when running tests in node, since there is no separate frontend process in this case.

The frontend debugger may also fail to attach if you break in your test backend's initialization for too long – if this happens you can just
manually re-attach once a chrome/electron window appears by launching the "Certa Tests (frontend)" configuration.

### Why We Use Predefined Ports

VS Code's Node.js debugger will normally add the `--inspect-brk={auto-determined port}` arg to programs listed in a launch.json configuration.
This is convenient for debugging most programs, since we usually don't know (or care) which port the debugger should use (and this guarantees
the port will be free). But this does nothing for us if we really care about debugging some child process of that program (i.e., electron).

However, if we specify a `port` option in that launch.json configuration, VS Code will omit the `--inspect-brk`, and let Certa decide
which child process should activate the v8 inspector.
> This also means that by specifying a port, you can safely set your launch.json to run `npm test -- --debug` if your test script uses Certa!

Note that VS Code does have an option to [autoAttachChildProcesses](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses),
but this only works by examining program arguments, which won't work if Certa _does_ end up deciding that the original process should be debugged.

## Bundling Tests

Here's an example webpack config that you can use to bundle your tests:

```JavaScript
const path = require("path");
const glob = require("glob");

function createConfig(shouldInstrument) {
  const config = {
    mode: "development",
    entry: glob.sync(path.resolve(__dirname, "lib/**/*.test.js")),
    output: {
      path: path.resolve(__dirname, "lib/dist"),
      filename: "bundled-tests.js",
      devtoolModuleFilenameTemplate: "file:///[absolute-resource-path]"
    },
    devtool: "nosources-source-map",
    module: {
      rules: [
        {
          test: /\.js$/,
          use: "source-map-loader",
          enforce: "pre"
        }
      ]
    },
  };

  if (shouldInstrument) {
    config.output.filename = "bundled-tests.instrumented.js";
    config.module.rules.push({
      test: /\.(jsx?|tsx?)$/,
      include: path.resolve(__dirname, "lib"),
      exclude: path.resolve(__dirname, "lib/test"),
      loader: "istanbul-instrumenter-loader",
      enforce: "post",
    });
  }

  return config;
}

// Exporting two configs in a array like this actually
// tells webpack to run twice - once for each config.
module.exports = [
  createConfig(true),
  createConfig(false)
]
```
