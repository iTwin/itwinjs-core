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
  initializeDefaultPatterns,
  initializeLineCodeCapacity,
  type LineCodeAssignmentArgs,
  lineCodeFromLinePixels,
  lineCodeTextureCapacity,
  lineCodeTextureSize,
  onLineCodeAssigned,
  resetLineCodeState,
} from "../../../common/internal/render/LineCode";

/** Describes one of the pre-defined line patterns. See Render.LinePixels.
 * @internal
 */
export namespace LineCode {
  export function valueFromLinePixels(pixels: LinePixels): number {
    return lineCodeFromLinePixels(pixels);
  }

  export function initializeCapacity(maxTexSize: number): void {
    initializeLineCodeCapacity(maxTexSize);
    // Recreate texture data array with the new capacity
    textureData = new Uint8Array(size * capacity());
    // Reset and reassign default patterns with new capacity
    isInitializing = true;
    resetLineCodeState();
    initializeDefaultPatterns();
    isInitializing = false;
  }

  export const solid = 0;
  export const size = lineCodeTextureSize;
  export function capacity(): number {
    return lineCodeTextureCapacity();
  }

  let textureData: Uint8Array | undefined;
  const textureUpdated = new BeEvent<() => void>();

  // Initialize with default capacity for tests that don't create a full System
  function ensureTextureData(): void {
    if (undefined === textureData) {
      textureData = new Uint8Array(size * capacity());
      initializeDefaultPatterns();
    }
  }

  function writeRow(code: number, pattern: number): void {
    ensureTextureData();
    if (code < 0 || code >= capacity())
      return;

    const offset = code * size;
    for (let i = 0; i < size; i++) {
      const bit = (pattern >>> i) & 0x1;
      textureData![offset + i] = bit ? 0xff : 0x00;
    }
  }

  let isInitializing = false;

  onLineCodeAssigned((args: LineCodeAssignmentArgs) => {
    writeRow(args.code, args.pattern);
    if (!isInitializing)
      textureUpdated.raiseEvent();
  });

  export function getTextureData(): Uint8Array {
    ensureTextureData();
    return textureData!;
  }

  export function onTextureUpdated(listener: () => void): () => void {
    textureUpdated.addListener(listener);
    return () => textureUpdated.removeListener(listener);
  }
}
