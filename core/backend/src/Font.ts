/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontType, LocalFileName } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";
import { trueTypeFontFileFromFileName } from "./internal/FontImpl";

export interface CadFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.Rsc | FontType.Shx;
  readonly familyName: string;
}

export type CadFontFileCreateArgs = {
  familyName: string;
} & ({
  blob: Uint8Array;
  fileName?: never;
} | {
  fileName: LocalFileName;
  blob?: never;
})

export namespace CadFontFile {
  export function create(_args: CadFontFileCreateArgs): CadFontFile {
    throw new Error("###TODO");
  }
}

export interface TrueTypeFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.TrueType;
  readonly isEmbeddable: boolean;
  readonly familyNames: ReadonlyArray<string>;
}

export type FontFile = CadFontFile | TrueTypeFontFile;

export namespace TrueTypeFontFile {
  export function fromFileName(fileName: LocalFileName): TrueTypeFontFile {
    return trueTypeFontFileFromFileName(fileName);
  }
}
