/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as yargs from "yargs";
import { IModelHost } from "@bentley/imodeljs-backend";
import { ImportIMJS } from "./ImportIMJS";

// tslint:disable:no-console

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

IModelHost.startup();
console.log("start ..");
const directoryTail = argv.input;
console.log("input from" + directoryTail);
if (directoryTail) {
  const fullBimName = "d:\\bfiles\\importIMJS\\" + directoryTail + ".bim";
  const importer = ImportIMJS.create(fullBimName,
    "testSubject");

  if (!importer) {
    console.log("Failed to create bim file");
  } else {
    const modelGroups = importer.importFilesFromDirectory(
      "..\\..\\core\\geometry\\src\\test\\output\\" + directoryTail + "\\");
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
IModelHost.shutdown();
console.log("goodbye");
