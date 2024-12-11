/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FontFace, FontType, LocalFileName } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { CreateFontFileFromShxBlobArgs, FontFile } from "../FontFile";
import { _implementationProhibited } from "./Symbols";
import { compareNumbersOrUndefined } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";

interface TrueTypeFontSource {
  readonly type: FontType.TrueType;
  readonly fileName: LocalFileName;
  readonly embeddable: boolean;
}

interface CadFontSource {
  readonly type: FontType.Shx | FontType.Rsc;
  readonly data: Uint8Array;
}

type FontSource = TrueTypeFontSource | CadFontSource;

class FontFileImpl implements FontFile {
  public readonly [_implementationProhibited] = undefined;

  public readonly faces: ReadonlyArray<Readonly<FontFace>>;
  public get type(): FontType { return this.source.type; }
  public get isEmbeddable(): boolean {
    return this.source.type !== FontType.TrueType || this.source.embeddable;
  }

  public readonly source: FontSource;
  public readonly faceProps: IModelJsNative.FontFaceProps[];

  public constructor(source: FontSource, faces: IModelJsNative.FontFaceProps[]) {
    this.source = source;
    this.faces = faces.map((face) => {
      return {
        familyName: face.familyName,
        isBold: face.faceName.startsWith("bold"),
        isItalic: face.faceName.endsWith("italic"),
      };
    });

    this.faceProps = faces;

    // Establish canonical ordering of key properties. This uniquely identifies a FontFile embedded as a row in an iModel's be_Prop table.
    this.faceProps.sort((a, b) =>
      a.familyName.localeCompare(b.familyName) || a.faceName.localeCompare(b.faceName) || compareNumbersOrUndefined(a.subId, b.subId)
    );
  }
}

export function shxFontFileFromBlob(args: CreateFontFileFromShxBlobArgs): FontFile {
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

  validateShx(args.blob);

  return new FontFileImpl({
    type: FontType.Shx,
    data: args.blob,
  }, [{
      faceName: "regular",
      familyName: args.familyName,
      type: FontType.Shx,
  }]);
}

export function trueTypeFontFileFromFileName(fileName: LocalFileName): FontFile {
  const metadata = IModelHost.platform.getTrueTypeFontMetadata(fileName);
  if (metadata.faces.length === 0) {
    // The input was almost certainly not a TrueType font file.
    throw new Error("Failed to read font file");
  }

  return new FontFileImpl({ type: FontType.TrueType, fileName, embeddable: metadata.embeddable }, metadata.faces);
}

