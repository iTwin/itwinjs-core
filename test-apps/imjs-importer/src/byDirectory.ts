/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import * as path from "path";
import { IModelHost } from "@itwin/core-backend";
import { ImportIMJS } from "./ImportIMJS";

/* eslint-disable no-console */

interface Args {
  input: string;
  output: string;
}

const argv: yargs.Arguments<Args> = yargs
  .usage("Usage: $0 --input [GeomJsonFileName]")
  .describe("input", "Input directory.  (Each .imjs file in the directory is inserted to the bim file.)")
  .string("input")
  .alias("input", "i")
  .describe("output", "Output iModel file name")
  .string("output")
  .alias("output", "o")
  .demandOption(["input", "output"])
  .argv;

IModelHost.startup().then(async () => {
  console.log("start ..");
  const directoryTail = argv.input;
  const outputFileName = argv.output;
  console.log(`input from${directoryTail}`);
  if (directoryTail) {
    const fullBimName = path.isAbsolute(outputFileName) ? outputFileName : `d:\\bfiles\\importIMJS\\${directoryTail}.bim`;
    console.log({ outputFile: fullBimName});
    const importer = ImportIMJS.create(fullBimName,
      "testSubject");

    if (!importer) {
      console.log("Failed to create bim file");
    } else {
      const inputDirName = path.isAbsolute(directoryTail) ? directoryTail : `..\\..\\core\\geometry\\src\\test\\output\\${directoryTail}\\`;
      const modelGroups = importer.importFilesFromDirectory(inputDirName);
      let numModel = 0;
      for (const group of modelGroups) {
        numModel += group.modelNames.length;
      }
      console.log({ directoryName: directoryTail, models: numModel });
      for (const group of modelGroups) {
        if (group.modelNames.length > 0) {
          console.log({
            groupName: group.groupName, numModel: group.modelNames.length,
            range: Math.floor(0.999999 + group.range.maxAbs()),
          });
        }
      }
    }
  }
  await IModelHost.shutdown();
  console.log("goodbye");
}).catch(() => { });
