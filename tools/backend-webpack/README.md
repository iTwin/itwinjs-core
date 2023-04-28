# backend-webpack-tools

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

The **backend-webpack-tools** package includes configuration and scripts for bundling iTwin.js service backends and agents.

## Available Scripts

### **backend-webpack-tools start**

Runs webpack in watch mode, and optionally starts the backend in either electron or node.

#### Required options

| Name       | Alias | Description                                  | Example         |
| ---------- | ----- | -------------------------------------------- | --------------- |
| `--source` | `-s`  | The main entry point for webpack             | `./lib/main.js` |
| `--outDir` | `-o`  | The directory where bundle should be emitted | `./dist/`       |

### **backend-webpack-tools build**

Builds an optimized "production" bundle.

#### Required options

| Name       | Alias | Description                                  | Example         |
| ---------- | ----- | -------------------------------------------- | --------------- |
| `--source` | `-s`  | The main entry point for webpack             | `./lib/main.js` |
| `--outDir` | `-o`  | The directory where bundle should be emitted | `./dist/`       |
