/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as Yargs from "yargs";
import {
  OpenMode,
} from "@bentley/bentleyjs-core";
import {
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import {
  IModelDb,
  IModelHost,
  IModelHostConfiguration,
  IModelJsFs,
} from "@bentley/imodeljs-backend";
import {
  ImageGraphicTransformer,
} from "./ImageGraphicTransformer";

interface Args {
  input: string;
  output: string;
  texture: string;
  width: string;
  height: string;
}

function logError(msg: string, ex?: Error): void {
  process.stdout.write(msg);
  if (undefined !== ex) {
    process.stderr.write("\n");
    process.stderr.write(ex.toString());
  }
}

function convertToImageGraphics(args: Yargs.Arguments<Args>): boolean {
  let format = ImageSourceFormat.Jpeg;
  const dotPos = args.texture.lastIndexOf(".");
  if (-1 !== dotPos) {
    switch (args.texture.substring(dotPos + 1).toLowerCase()) {
      case "png":
        format = ImageSourceFormat.Png;
        break;
      case "jpg":
      case "jpeg":
        break;
      default:
        logError("Supported image types: .jpg, .jpeg, or .png");
        return false;
    }
  }

  if (!IModelJsFs.existsSync(args.texture)) {
    logError("Texture image file not found.");
    return false;
  }

  let data;
  try {
    const textureBytes = IModelJsFs.readFileSync(args.texture) as Buffer;
    data = textureBytes.toString("base64");
  } catch (ex) {
    logError("Failed to read texture image", ex);
    return false;
  }

  let srcDb;
  try {
    srcDb = IModelDb.openStandalone(args.input, OpenMode.Readonly);
  } catch (ex) {
    logError("Failed to open input file.\n", ex);
    return false;
  }

  let dstDb;
  try {
    dstDb = IModelDb.createSnapshot(args.output, { rootSubject: { name: "ImageGraphicConversion" } });
  } catch (ex) {
    logError("Failed to create output file.\n", ex);
    return false;
  }

  // ImageGraphicTransformer throws on any error.
  let transformed = true;
  try {
    ImageGraphicTransformer.transform(srcDb, dstDb, { data, format, width: args.width as any, height: args.height as any });
    dstDb.saveChanges();
  } catch (ex) {
    logError("Conversion failed", ex);
    transformed = false;
  } finally {
    dstDb.closeSnapshot();
    srcDb.closeStandalone();
  }

  return transformed;
}

function main(): void {
  Yargs.usage("Import a .png or .jpeg image into an existing iModel as a Texture element.");
  Yargs.required("input", "Path to the existing input iModel");
  Yargs.required("output", "Path to the output iModel to be created");
  Yargs.required("texture", "Path to the .png or .jpeg image to import");
  Yargs.required("width", "Width of the texture image");
  Yargs.required("height", "Height of the texture image");
  Yargs.number(["width", "height"]);

  const args = Yargs.parse() as Yargs.Arguments<Args>;

  IModelHost.startup(new IModelHostConfiguration());
  if (convertToImageGraphics(args))
    process.stdout.write("Conversion complete.\n");
  else
    process.stderr.write("Unknown exception occurred.\n");
}

main();
