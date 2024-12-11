/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontFace, FontType, LocalFileName } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";
import { shxFontFileFromBlob } from "./internal/FontFileImpl"; 

export interface FontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
  readonly type: FontType;
  readonly faces: ReadonlyArray<Readonly<FontFace>>;
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
  export function createFromTrueTypeFile(_fileName: LocalFileName): FontFile  {
    throw new Error("###TODO");
  }

  export function createFromShxFontBlob(args: CreateFontFileFromShxBlobArgs): FontFile {
    return shxFontFileFromBlob(args);
  }

  export function createFromRscFontBlob(_args: CreateFontFileFromRscBlobArgs): FontFile {
    throw new Error("###TODO");
  }
}
