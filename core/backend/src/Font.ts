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

export interface ShxFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.Shx;
  readonly familyName: string;
}

export namespace ShxFontFile {
  export function fromFileOrBlob(_args: {
    familyName: string;
    source: Uint8Array | LocalFileName;
  }): ShxFontFile {
    throw new Error("###TODO");
  }
}

export interface RscFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.Rsc;
  readonly familyName: string;
}

export interface TrueTypeFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.TrueType;
  readonly isEmbeddable: boolean;
  readonly familyNames: ReadonlyArray<string>;
}

export type FontFile = ShxFontFile | RscFontFile | TrueTypeFontFile;

export namespace TrueTypeFontFile {
  export function fromFileName(fileName: LocalFileName): TrueTypeFontFile {
    return trueTypeFontFileFromFileName(fileName);
  }
}
