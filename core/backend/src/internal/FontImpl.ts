/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { FontFile, IModelDbFonts, ShxFontFile, ShxFontFileFromBlobArgs, TrueTypeFontFile } from "../Font";
import { FontId, FontProps, FontType, LocalFileName } from "@itwin/core-common";
import { IModelHost } from "../IModelHost";
import { _implementationProhibited } from "./Symbols";
import { IModelDb } from "../IModelDb";
        
export function trueTypeFontFileFromFileName(fileName: LocalFileName): TrueTypeFontFile {
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

export function shxFontFileFromBlob(args: ShxFontFileFromBlobArgs): ShxFontFile {
  validateShx(args.blob);

  return {
    [_implementationProhibited]: undefined,
    type: FontType.Shx,
    familyName: args.familyName,
  };
}

export class IModelDbFontsImpl implements IModelDbFonts {
  public readonly [_implementationProhibited] = undefined;
  
  private readonly _iModel: IModelDb;

  public constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  public get embeddedFontNames(): Iterable<string> {
    throw new Error("###TODO");
  }

  public get embeddedFonts(): Iterable<FontProps> {
    throw new Error("###TODO");
  }

  public get allocatedIds(): Iterable<{ name: string, id: FontId}> {
    throw new Error("###TODO");
  }

  public findId(_name: string): FontId | undefined {
    throw new Error("###TODO");
  }

  public findName(_id: FontId): string | undefined {
    throw new Error("###TODO");
  }

  public async acquireId(_name: string): Promise<FontId> {
    throw new Error("###TODO");
  }

  public embedFile(_file: FontFile): void {
    throw new Error("###TODO");
  }
}
