#!/usr/bin/env node

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

"use strict";

const yargs = require("yargs");
const argv = yargs
  .strict(true)
  .wrap(Math.min(150, yargs.terminalWidth()))
  .command(require("../scripts/linkextensions"))
  .command(require("../scripts/copyConfig")).argv;
