/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EOL } from "os";
import * as path from "path";
// import * as yargs from "yargs";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelHost } from "@bentley/imodeljs-backend";
import { CloneIModel } from "./Clone";

// interface Args {
//   input: string;
//   output: string;
// }

/** Use [yargs](https://www.npmjs.com/package/yargs) to validate and extract command line options. */
// const argv: yargs.Arguments<Args> = yargs
//   .usage("Usage: $0 --input [GeomJsonFileName] --output [iModelFileName]")
//   .describe("input", "Input GeoJSON file name")
//   .string("input")
//   .alias("input", "i")
//   .describe("output", "Output iModel file name")
//   .string("output")
//   .alias("output", "o")
//   .describe("append", "Append to existing IModel")
//   .boolean("append")
//   .alias("append", "a")
//   .describe("model_name", "Model Name")
//   .alias("model_name", "m")
//   .string("model_name")
//   .describe("label", "Propery name for object label")
//   .string("label")
//   .alias("label", "l")
//   .describe("point_radius", "Radius for point geometry")
//   .number("point_radius")
//   .alias("point_radius", "r")
//   .describe("color", "Add random colors")
//   .boolean("color")
//   .describe("map", "Background Map (none, aerial, streets, hybrid)")
//   .choices("map", ["none", "aerial", "streets", "hybrid"])
//   .describe("mapBias", "Background Map ground bias")
//   .number("mapBias")
//   .describe("classifiedName", "Add classified reality model name")
//   .string("classifiedName")
//   .describe("classifiedURL", "Add classified reality model URL")
//   .string("classifiedURL")
//   .describe("classifiedOutside", "Classifier Outside (on, off, dimmed, hilite, color)")
//   .choices("classifiedOutside", ["on", "off", "dimmed", "hilite", "color"])
//   .describe("classifiedInside", "Classifier Outside (on, off, dimmed, hilite, color)")
//   .choices("classifiedInside", ["on", "off", "dimmed", "hilite", "color"])
//   .demandOption(["input", "output"])
//   .argv;

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  // initialize logging
  if (true) {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
    Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
    Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
  }

  // const geoJson = new GeoJson(argv.input);
  // const importer = new GeoJsonImporter(argv.output, geoJson, argv.append as boolean, argv.model_name as string, argv.label as string, argv.point_radius as number, argv.color as boolean,
  //   argv.map as string, argv.mapBias as number,
  //   argv.classifiedURL as string, argv.classifiedName as string, argv.classifiedOutside as string, argv.classifiedInside as string);

  process.stdout.write(`Transform2${EOL}`);
  let sourceFileName: string;
  let targetFileName: string;
  if (false) {
    sourceFileName = "D:/data/bim/snapshots/467d20b7-cf9b-4407-9052-237790253db7.bim";
    targetFileName = path.join(__dirname, "fmg-clone.bim");
  } else {
    sourceFileName = "D:/data/bim/snapshots/shell4.bim";
    targetFileName = path.join(__dirname, "shell4-clone.bim");
  }
  process.stdout.write(`Clone ${sourceFileName} --> ${targetFileName}${EOL}`);
  await CloneIModel.clone(sourceFileName, targetFileName);
  await IModelHost.shutdown();
})();
