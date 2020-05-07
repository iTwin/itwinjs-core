/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ClipVector } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";

/** @internal */
export interface ViewClipSettings {
  /** The ClipVector to use when clipping. It must not be modified. */
  clipVector: ClipVector;
  /** If defined, contains a color to apply to pixels of the geometry outside the clipped region. */
  outsideColor?: ColorDef;
  /** If defined, contains color to apply to pixels of the geometry inside the clipped region. */
  insideColor?: ColorDef;
}

/** @internal */
export function createViewClipSettings(clipVector?: ClipVector, outsideColor?: ColorDef, insideColor?: ColorDef): ViewClipSettings | undefined {
  return clipVector !== undefined ? { clipVector, outsideColor, insideColor } : undefined;
}
