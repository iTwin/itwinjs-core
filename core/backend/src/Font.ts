/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontType, LocalFileName } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";

export interface FontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType;
  readonly isTrueType: () => this is TrueTypeFontFile;
}

export interface TrueTypeFontFile extends FontFile {
  readonly isEmbeddable: boolean;
  readonly familyNames: ReadonlyArray<string>;
}

export namespace FontFile {
  export function fromBlob(_blob: Uint8Array): FontFile {
    throw new Error("###TODO");
  }

  export function fromFileName(_fileName: LocalFileName): FontFile {
    throw new Error("###TODO");
  }
}
