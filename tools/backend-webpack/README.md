# backend-webpack-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

The __backend-webpack-tools__ package includes configuration and scripts for bundling iTwin.js service backends and agents.

## Available Scripts

### __backend-webpack-tools start__

Runs webpack in watch mode, and optionally starts the backend in either electron or node.

#### Required options

| Name | Alias | Description | Example |
| - | - | - | - |
| `--source` | `-s` | The main entry point for webpack | `./lib/main.js` |
| `--outDir` | `-o` | The directory where bundle should be emitted | `./dist/` |

### __backend-webpack-tools build__

Builds an optimized "production" bundle.

#### Required options

| Name | Alias | Description | Example |
| - | - | - | - |
| `--source` | `-s` | The main entry point for webpack | `./lib/main.js` |
| `--outDir` | `-o` | The directory where bundle should be emitted | `./dist/` |