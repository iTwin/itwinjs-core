/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { FontFile, ShxFontFile, ShxFontFileFromBlobArgs, ShxFontFileFromFileNameArgs, TrueTypeFontFile } from "../Font";
import { FontType, LocalFileName } from "@itwin/core-common";
import { IModelHost } from "../IModelHost";
import { _implementationProhibited } from "./Symbols";
        
export async function trueTypeFontFileFromFileName(fileName: LocalFileName): Promise<TrueTypeFontFile> {
  const metadata = IModelHost.platform.getTrueTypeFontMetadata(fileName);
  if (!metadata.familyNames) {
    // The input was almost certainly not a TrueType font file.
    throw new Error("Failed to read font file");
  }

  return {
    [_implementationProhibited]: undefined,
    type: FontType.TrueType,
    isEmbeddable: metadata.embeddable,
    familyNames: metadata.familyNames,
  };
}

// An SHX file with fewer than 40 bytes isn't valid.
const minShxSize = 40;

const shxHeaders = [
  "AutoCAD-86 unifont 1.0",
  "AutoCAD-86 shapes 1.0",
  "AutoCAD-86 shapes 1.1",
].map((shxHeader) => Array.from(shxHeader))
.map((chars) => new Uint8Array(chars.map((ch) => ch.charCodeAt(0))));

// See https://github.com/iTwin/imodel-native/blob/91f509c2175dc49ce1efcf5a906c9a9aa193451d/iModelCore/iModelPlatform/DgnCore/ShxFont.cpp#L44
function validateShx(blob: Uint8Array): void {
  if (blob.length >= minShxSize) {
    for (const header of shxHeaders) {
      if (header.every((char, index) => char === blob[index])) {
        return;
      }
    }
  }
  
  throw new Error("Failed to read font file");
}

export async function shxFontFileFromFileName(args: ShxFontFileFromFileNameArgs): Promise<ShxFontFile> {
  const read = new Promise<Uint8Array>((resolve, reject) => {
    try {
      const stream = fs.createReadStream(args.fileName, { end: minShxSize });
      stream.on("error", (e) => reject(e));
      stream.on("data", (chunk: Buffer) => {
        stream.close();
        resolve(chunk);
      });
    } catch (e) {
      reject(e);
    }
  });

  const blob = await read;
  return shxFontFileFromBlob({ blob, familyName: args.familyName });
}

export function shxFontFileFromBlob(args: ShxFontFileFromBlobArgs): ShxFontFile {
  validateShx(args.blob);

  return {
    [_implementationProhibited]: undefined,
    type: FontType.Shx,
    familyName: args.familyName,
  };
}
