/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { FontFace, FontType, LocalFileName } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { CreateFontFileFromRscBlobArgs, CreateFontFileFromShxBlobArgs, FontFile } from "../FontFile";
import { _faceProps, _getData, _key, _implementationProhibited } from "./Symbols";
import { compareNumbersOrUndefined } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";
import { IModelDb } from "../IModelDb";

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

abstract class FontFileImpl implements FontFile {
  public readonly [_implementationProhibited] = undefined;

  public readonly faces: ReadonlyArray<Readonly<FontFace>>;
  public abstract get type(): FontType;
  public get isEmbeddable(): boolean { return true; }

  public readonly [_key]: string;
  public readonly [_faceProps]: IModelJsNative.FontFaceProps[];

  protected constructor(faces: IModelJsNative.FontFaceProps[]) {
    this.faces = faces.map((face) => {
      return {
        familyName: face.familyName,
        isBold: face.faceName.startsWith("bold"),
        isItalic: face.faceName.endsWith("italic"),
      };
    });

    this[_faceProps] = faces;

    // Sort the face props in canonical order so we can compare FontFiles for equivalent contents.
    this[_faceProps].sort((a, b) =>
      a.familyName.localeCompare(b.familyName) || a.faceName.localeCompare(b.faceName) || compareNumbersOrUndefined(a.subId, b.subId)
    );

    // Stringify the face props so that the key properties (and no other properties) appear in a canonical order. for trivial comparisons.
    this[_key] = JSON.stringify(this[_faceProps], ["familyName", "faceName", "type", "subId"]);
  }

  public abstract [_getData](): Uint8Array;
}

class TrueTypeFontFile extends FontFileImpl {
  readonly #fileName: LocalFileName;
  readonly #embeddable: boolean;
  
  public constructor(fileName: LocalFileName, embeddable: boolean, faces: IModelJsNative.FontFaceProps[]) {
    super(faces);
    this.#fileName = fileName;
    this.#embeddable = embeddable;
  }

  public override get type(): FontType { return FontType.TrueType; }
  public override get isEmbeddable(): boolean { return this.#embeddable; }

  public override [_getData](): Uint8Array {
    return fs.readFileSync(this.#fileName);
  }
}

export class CadFontFile extends FontFileImpl {
  readonly #data: Uint8Array;
  readonly #type: FontType.Shx | FontType.Rsc;

  public constructor(data: Uint8Array, type: FontType.Shx | FontType.Rsc, faces: IModelJsNative.FontFaceProps[]) {
    super(faces);
    this.#data = data;
    this.#type = type;
  }

  public override get type(): FontType { return this.#type; }

  public override [_getData](): Uint8Array { return this.#data; }
}

export class EmbeddedFontFile extends FontFileImpl {
  // The value of the Id column for the row in the be_Prop table that embeds this font's data.
  readonly #db: IModelDb;
  readonly #id: number;
  readonly #type: FontType;

  public constructor(db: IModelDb, id: number, type: FontType, faces: IModelJsNative.FontFaceProps[]) {
    super(faces);
    this.#db = db;
    this.#id = id;
    this.#type = type;
  }

  public override get type(): FontType { return this.#type; }

  public override [_getData](): Uint8Array {
    const data = this.#db.queryFilePropertyBlob({
      namespace: "dgn_Font",
      name: "EmbeddedFaceData",
      id: this.#id,
    });

    if (!data) {
      throw new Error("Embedded font not found");
    }

    return data;
  }
}

export function shxFontFileFromBlob(args: CreateFontFileFromShxBlobArgs): FontFile {
  if (args.familyName.length === 0) {
    throw new Error("Font family name cannot be empty");
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

  validateShx(args.blob);

  return new CadFontFile(args.blob, FontType.Shx, [{
    faceName: "regular",
    familyName: args.familyName,
    type: FontType.Shx,
  }]);
}

export function rscFontFileFromBlob(args: CreateFontFileFromRscBlobArgs): FontFile {
  if (args.familyName.length === 0) {
    throw new Error("Font family name cannot be empty");
  }

  if (!IModelHost.platform.isRscFontData(args.blob)) {
    throw new Error("Failed to read font file");
  }

  return new CadFontFile(args.blob, FontType.Rsc, [{
    faceName: "regular",
    familyName: args.familyName,
    type: FontType.Rsc,
    encoding: args.encoding,
  }]);
}

export function trueTypeFontFileFromFileName(fileName: LocalFileName): FontFile {
  const metadata = IModelHost.platform.getTrueTypeFontMetadata(fileName);
  if (metadata.faces.length === 0) {
    // The input was almost certainly not a TrueType font file.
    throw new Error("Failed to read font file");
  }

  return new TrueTypeFontFile(fileName, metadata.embeddable, metadata.faces);
}

