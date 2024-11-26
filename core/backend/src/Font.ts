/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

import { FontType, LocalFileName } from "@itwin/core-common";
import { _implementationProhibited } from "./internal/Symbols";

export interface FontFileFromBlobArgs {
  type: FontType;
  blob: Uint8Array;
}

export interface FontFile {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly type: FontType;
  readonly isEmbeddable: boolean;
  readonly familyNames: ReadonlyArray<string>;
}

export namespace FontFile {
  export function fromBlob(_args: FontFileFromBlobArgs): FontFile {
    throw new Error("###TODO");
  }

  export function fromFileName(_fileName: LocalFileName): FontFile {
    throw new Error("###TODO");
  }
}

export interface FontFileCollection {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  readonly files: ReadonlyArray<FontFile>;
}

export namespace FontFileCollection {
  export function fromBlobs(_blobs: Iterable<FontFileFromBlobArgs>): FontFileCollection {
    throw new Error("###TODO");
  }

  export function fromFileNames(_fileNames: Iterable<LocalFileName>): FontFileCollection {
    throw new Error("###TODO");
  }
}
