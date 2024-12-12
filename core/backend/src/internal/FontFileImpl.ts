/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
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

export class FontFileImpl implements FontFile {
  public readonly [_implementationProhibited] = undefined;

  public readonly faces: ReadonlyArray<Readonly<FontFace>>;
  public get type(): FontType { return this.#source.type; }
  public get isEmbeddable(): boolean {
    return this.#source.type !== FontType.TrueType || this.#source.embeddable;
  }

  public readonly key: string;
  public readonly faceProps: IModelJsNative.FontFaceProps[];
  readonly #source: FontSource;

  public constructor(source: FontSource, faces: IModelJsNative.FontFaceProps[]) {
    this.#source = source;
    this.faces = faces.map((face) => {
      return {
        familyName: face.familyName,
        isBold: face.faceName.startsWith("bold"),
        isItalic: face.faceName.endsWith("italic"),
      };
    });

    this.faceProps = faces;

    // Sort the face props in canonical order so we can compare FontFiles for equivalent contents.
    this.faceProps.sort((a, b) =>
      a.familyName.localeCompare(b.familyName) || a.faceName.localeCompare(b.faceName) || compareNumbersOrUndefined(a.subId, b.subId)
    );

    // Stringify the face props so that the key properties (and no other properties) appear in a canonical order. for trivial comparisons.
    this.key = JSON.stringify(this.faceProps, ["familyName", "faceName", "type", "subId"]);
  }

  public getData(): Uint8Array {
    if (this.#source.type !== FontType.TrueType) {
      return this.#source.data;
    }

    return fs.readFileSync(this.#source.fileName);
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

