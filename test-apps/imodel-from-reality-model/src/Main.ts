/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
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
  .demandOption(["input", "output"])
  .argv;

IModelHost.startup();
Logger.initializeToConsole();

const creator = new RealityModelContextIModelCreator(argv.output as string, argv.input as string);
creator.create().then(() => {
  process.stdout.write("IModel: " + argv.output + " Created for Reality Model: " + argv.input);
}).catch(() => {
  process.stdout.write("Error occurred creating IModel\n");
});

IModelHost.shutdown();
