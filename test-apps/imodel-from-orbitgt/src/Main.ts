/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import { Logger } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { OrbitGtContextIModelCreator } from "./OrbitGtContextModelCreator";

/** Use [yargs](https://www.npmjs.com/package/yargs) to validate and extract command line options. */
const argv = yargs
  .usage("Usage: $0 --input [RealityModelURL] --output [iModelFileName]")
  .describe("rdsUrl", "RDS URL")
  .string("rdsUrl")
  .describe("accountName", "Account Name")
  .string("accountName")
  .describe("sasToken", "SAS Token")
  .string("sasToken")
  .describe("containerName", "Container Name")
  .default("containerName", "samples")
  .string("containerName")
  .describe("blobFileName", "Blob File Name")
  .string("blobFileName")
  .describe("output", "Output iModel file name")
  .string("output")
  .alias("output", "o")
  .string("name")
  .describe("name", "Name (displayed in GUI and tool tip)")
  .demandOption(["accountName", "sasToken", "blobFileName", "output"])
  .parseSync();

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup({ profileName: "imodel-from-orbitgt" });
  Logger.initializeToConsole();

  const pcProps = {
    rdsUrl: argv.rdsUrl as string,
    accountName: argv.accountName,
    sasToken: argv.sasToken,
    containerName: argv.containerName,
    blobFileName: argv.blobFileName,
  };

  const creator = new OrbitGtContextIModelCreator(pcProps, argv.output, argv.name as string);
  try {
    await creator.create();
    process.stdout.write(`IModel: ${argv.output} Created for Point Cloud: ${argv.blobFileName}`);
    await IModelHost.shutdown();
  } catch {
    process.stdout.write("Error occurred creating IModel\n");
    await IModelHost.shutdown();
  }
})();
