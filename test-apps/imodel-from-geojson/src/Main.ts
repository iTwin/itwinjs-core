/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as yargs from "yargs";
import { Logger } from "@itwin/core-bentley";
import { IModelHost } from "@itwin/core-backend";
import { GeoJson } from "./GeoJson";
import { GeoJsonImporter } from "./GeoJsonImporter";

interface Args {
  input: string;
  output: string;
}

/** Use [yargs](https://www.npmjs.com/package/yargs) to validate and extract command line options. */
const argv: yargs.Arguments<Args> = yargs
  .usage("Usage: $0 --input [GeomJsonFileName] --output [iModelFileName]")
  .describe("input", "Input GeoJSON file name")
  .string("input")
  .alias("input", "i")
  .describe("output", "Output iModel file name")
  .string("output")
  .alias("output", "o")
  .describe("append", "Append to existing IModel")
  .boolean("append")
  .alias("append", "a")
  .describe("model_name", "Model Name")
  .alias("model_name", "m")
  .string("model_name")
  .describe("label", "Propery name for object label")
  .string("label")
  .alias("label", "l")
  .describe("point_radius", "Radius for point geometry")
  .number("point_radius")
  .alias("point_radius", "r")
  .describe("color", "Add random colors")
  .boolean("color")
  .describe("map", "Background Map (none, aerial, streets, hybrid)")
  .choices("map", ["none", "aerial", "streets", "hybrid"])
  .describe("mapBias", "Background Map ground bias")
  .number("mapBias")
  .describe("classifiedName", "Add classified reality model name")
  .string("classifiedName")
  .describe("classifiedURL", "Add classified reality model URL")
  .string("classifiedURL")
  .describe("classifiedOutside", "Classifier Outside (on, off, dimmed, hilite, color)")
  .choices("classifiedOutside", ["on", "off", "dimmed", "hilite", "color"])
  .describe("classifiedInside", "Classifier Outside (on, off, dimmed, hilite, color)")
  .choices("classifiedInside", ["on", "off", "dimmed", "hilite", "color"])
  .demandOption(["input", "output"])
  .argv;

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  await IModelHost.startup();
  Logger.initializeToConsole();

  const geoJson = new GeoJson(argv.input);
  const importer = new GeoJsonImporter(argv.output, geoJson, argv.append as boolean, argv.model_name as string, argv.label as string, argv.point_radius as number, argv.color as boolean,
    argv.map as string, argv.mapBias as number,
    argv.classifiedURL as string, argv.classifiedName as string, argv.classifiedOutside as string, argv.classifiedInside as string);

  try {
    await importer.import();
    process.stdout.write(`IModel: ${argv.output} Created for GeoJson: ${argv.input}\n`);
    await IModelHost.shutdown();
  } catch (_error) {
    process.stdout.write("Error occurred\n");
  }
})();
