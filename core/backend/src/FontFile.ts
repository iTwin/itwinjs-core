/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontFace, FontType, LocalFileName } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { _faceProps, _getData, _key, _implementationProhibited } from "./internal/Symbols";
import { shxFontFileFromBlob, trueTypeFontFileFromFileName } from "./internal/FontFileImpl"; 

export interface FontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType;
  readonly faces: ReadonlyArray<Readonly<FontFace>>;
  readonly isEmbeddable: boolean;

  /**
   * @internal
   */
  readonly [_key]: string;

  /**
   * @internal
   */
  readonly [_getData]: () => Uint8Array;

  /**
   * @internal
   */
   readonly [_faceProps]: IModelJsNative.FontFaceProps[];
}

export interface CreateFontFileFromShxBlobArgs {
  familyName: string;
  blob: Uint8Array;
}

export interface CreateFontFileFromRscBlobArgs {
  familyName: string;
  blob: Uint8Array;
}

export namespace FontFile {
  export function createFromTrueTypeFileName(fileName: LocalFileName): FontFile  {
    return trueTypeFontFileFromFileName(fileName);
  }

  export function createFromShxFontBlob(args: CreateFontFileFromShxBlobArgs): FontFile {
    return shxFontFileFromBlob(args);
  }

  export function createFromRscFontBlob(_args: CreateFontFileFromRscBlobArgs): FontFile {
    throw new Error("###TODO");
  }
}
