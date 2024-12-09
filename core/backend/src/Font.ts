/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontId, FontProps, FontType, LocalFileName } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";
import { shxFontFileFromBlob, trueTypeFontFileFromFileName } from "./internal/FontImpl";

export interface ShxFontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType.Shx;
  readonly familyName: string;
}

export interface ShxFontFileFromBlobArgs {
  blob: Uint8Array;
  familyName: string;
}

export namespace ShxFontFile {
  export function fromBlob(args: ShxFontFileFromBlobArgs): ShxFontFile {
    return shxFontFileFromBlob(args);
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

export interface IModelDbFonts {
  /** @internal */
  [_implementationProhibited]: unknown;

  readonly embeddedFontNames: Iterable<string>;
  readonly embeddedFonts: Iterable<FontProps>;
  readonly allocatedIds: Iterable<{ name: string, id: FontId }>;

  findId(name: string): FontId | undefined;
  findName(id: FontId): string | undefined;

  acquireId(name: string): Promise<FontId>;

  embedFile(file: FontFile): Promise<void>;
}
