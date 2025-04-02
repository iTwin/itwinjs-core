/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontFace, FontType, LocalFileName, RscFontEncodingProps } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { _faceProps, _getData, _implementationProhibited, _key } from "./internal/Symbols.js";
import { rscFontFileFromBlob, shxFontFileFromBlob, trueTypeFontFileFromFileName } from "./internal/FontFileImpl.js";

/** A container for one or more [font faces]($docs/learning/backend/Fonts.md), often originating as a file on disk.
 * @see [[FontFile.createFromTrueTypeFileName]] and [[FontFile.createFromShxFontBlob]] to create a font file.
 * @see [[IModelDbFonts.queryEmbeddedFontFiles]] to obtain font files embedded in an [[IModelDb]].
 * @see [[IModelDbFonts.embedFontFile]] to embed a font file into an [[IModelDb]].
 * @beta
 */
export interface FontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** The format in which the font data is encoded. */
  readonly type: FontType;
  /** The individual faces encoded into the file. */
  readonly faces: ReadonlyArray<Readonly<FontFace>>;
  /** If false, the font is not licensed for embedding, and attempting to embed it into an iModel will throw an error. */
  readonly isEmbeddable: boolean;

  /** A canonical representation of this font's contents, used for comparing two font files for equivalence.
   * @internal
   */
  readonly [_key]: string;

  /** Returns the raw (but uncompressed) binary data.
   * @internal
   */
  readonly [_getData]: () => Uint8Array;

  /** Native representation of [[faces]].
   * @internal
   */
   readonly [_faceProps]: IModelJsNative.FontFaceProps[];
}

/** Arguments supplied to [[FontFile.createFromShxFontBlob]].
 * @beta
 */
export interface CreateFontFileFromShxBlobArgs {
  /** The name to give to the font family contained in the [[blob]]. */
  familyName: string;
  /** The binary representation of the SHX font face. */
  blob: Uint8Array;
}

/** Arguments supplied to [[FontFile.CreateFromRscFontBlob]].
 * @alpha
 */
export interface CreateFontFileFromRscBlobArgs {
  /** The name to give to the font family contained in the [[blob]]. */
  familyName: string;
  /** The binary, flat-buffer-encoded representation of the RSC font face. */
  blob: Uint8Array;
  /** The font's encoding. */
  encoding?: RscFontEncodingProps;
}

/** @beta */
export namespace FontFile {
  /** Create a FontFile from a [FontType.TrueType]($common) file on disk.
   * @param fileName The absolute path to the font file.
   */
  export function createFromTrueTypeFileName(fileName: LocalFileName): FontFile  {
    return trueTypeFontFileFromFileName(fileName);
  }

  /** Create a FontFile from the binary representation of a [FontType.SHX]($common) font face. */
  export function createFromShxFontBlob(args: CreateFontFileFromShxBlobArgs): FontFile {
    return shxFontFileFromBlob(args);
  }

  /** Create a FontFile from the binary representation of a [FontType.RSC]($common) font face.
   * @alpha
   */
  export function createFromRscFontBlob(args: CreateFontFileFromRscBlobArgs): FontFile {
    return rscFontFileFromBlob(args);
  }
}
