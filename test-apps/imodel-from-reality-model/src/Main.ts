/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import { Logger } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { RealityModelContextIModelCreator } from "./RealityModelContextIModelCreator";

/** Use [yargs](https://www.npmjs.com/package/yargs) to validate and extract command line options. */
const argv: yargs.Arguments<{}> = yargs
  .usage("Usage: $0 --input [RealityModelURL] --output [iModelFileName]")
  .describe("input", "Reality Model URL")
  .string("input")
  .alias("input", "i")
  .describe("output", "Output iModel file name")
  .string("output")
  .alias("output", "o")
  .string("name")
  .describe("name", "Name (displayed in GUI and tool tip)")
  .demandOption(["input", "output"])
  .argv;

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  Logger.initializeToConsole();

  const creator = new RealityModelContextIModelCreator(argv.output as string, argv.input as string, argv.name as string);
  try {
    await creator.create();
    process.stdout.write(`IModel: ${argv.output} Created for Reality Model: ${argv.input}`);
  } catch (_error) {
    process.stdout.write("Error occurred creating IModel\n");
  }

  await IModelHost.shutdown();
})();
