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

interface Args {
  input: string;
  output: string;
  texture: string;
}

function logError(msg: string, ex?: Error): void {
  process.stdout.write(msg);
  if (undefined !== ex) {
    process.stderr.write("\n");
    process.stderr.write(ex.toString());
  }
}

function convertToImageGraphics(args: Yargs.Arguments<Args>): boolean {
  let fmt;
  const dotPos = args.texture.lastIndexOf(".");
  if (-1 !== dotPos) {
    switch (args.texture.substring(dotPos + 1).toLowerCase()) {
      case "png":
        fmt = ImageSourceFormat.Png;
        break;
      case "jpg":
      case "jpeg":
        fmt = ImageSourceFormat.Jpeg;
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

  let textureBytes64;
  try {
    const textureBytes = IModelJsFs.readFileSync(args.texture) as Buffer;
    textureBytes64 = textureBytes.toString("base64");
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

  return true;
}

function main(): void {
  Yargs.usage("Import a .png or .jpeg image into an existing iModel as a Texture element.");
  Yargs.required("input", "Path to the existing input iModel");
  Yargs.required("output", "Path to the output iModel to be created");
  Yargs.required("texture", "Path to the .png or .jpeg image to import");
  const args = Yargs.parse() as Yargs.Arguments<Args>;

  IModelHost.startup(new IModelHostConfiguration());
  if (convertToImageGraphics(args))
    process.stdout.write("Conversion complete.");
}

main();
