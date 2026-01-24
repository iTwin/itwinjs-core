/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { BeEvent } from "@itwin/core-bentley";
import { LinePixels } from "@itwin/core-common";
import {
  getLineCodePatterns,
  type LineCodeAssignmentArgs,
  lineCodeFromLinePixels,
  lineCodeTextureCapacity,
  lineCodeTextureSize,
  onLineCodeAssigned,
} from "../../../common/internal/render/LineCode";

/** Describes one of the pre-defined line patterns. See Render.LinePixels.
 * @internal
 */
export namespace LineCode {
  export function valueFromLinePixels(pixels: LinePixels): number {
    return lineCodeFromLinePixels(pixels);
  }

  export const solid = 0;
  export const size = lineCodeTextureSize;
  export const capacity = lineCodeTextureCapacity;

  const textureData = new Uint8Array(size * capacity);
  const textureUpdated = new BeEvent<() => void>();

  function writeRow(code: number, pattern: number): void {
    if (code < 0 || code >= capacity)
      return;

    const offset = code * size;
    for (let i = 0; i < size; i++) {
      const bit = (pattern >>> i) & 0x1;
      textureData[offset + i] = bit ? 0xff : 0x00;
    }
  }

  let isInitializing = true;
  function initializeTexture(): void {
    const assignedPatterns = getLineCodePatterns();
    for (let i = 0; i < assignedPatterns.length && i < capacity; i++)
      writeRow(i, assignedPatterns[i]);
    isInitializing = false;
  }

  initializeTexture();

  onLineCodeAssigned((args: LineCodeAssignmentArgs) => {
    writeRow(args.code, args.pattern);
    if (!isInitializing)
      textureUpdated.raiseEvent();
  });

  export function getTextureData(): Uint8Array {
    return textureData;
  }

  export function onTextureUpdated(listener: () => void): () => void {
    textureUpdated.addListener(listener);
    return () => textureUpdated.removeListener(listener);
  }
}
