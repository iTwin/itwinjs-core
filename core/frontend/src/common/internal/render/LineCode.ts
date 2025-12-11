/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { BeEvent } from "@itwin/core-bentley";
import { LinePixels } from "@itwin/core-common";

/** @internal */
export interface LineCodeAssignmentArgs {
  /** Zero-based index of the new pattern within the texture. */
  readonly code: number;
  /** The 32-bit bitfield representing the pattern written into the texture. */
  readonly pattern: number;
}

const textureSize = 32;
const maxLineCodeSlots = 4096;

const patternToCode = new Map<number, number>();
const patterns: number[] = [];
const assignmentEvent = new BeEvent<(args: LineCodeAssignmentArgs) => void>();

const defaultPatterns: LinePixels[] = [
  LinePixels.Solid,
  LinePixels.Code1,
  LinePixels.Code2,
  LinePixels.Code3,
  LinePixels.Code4,
  LinePixels.Code5,
  LinePixels.Code6,
  LinePixels.Code7,
  LinePixels.HiddenLine,
  LinePixels.Invisible,
];

function normalizePatternValue(pixels: LinePixels): number | undefined {
  switch (pixels) {
    case LinePixels.Invalid:
      return normalizePatternValue(LinePixels.Solid);
    case LinePixels.Solid:
    case LinePixels.Code0:
      return 0xffffffff;
    default:
      return pixels >>> 0;
  }
}

function assignCodeForPattern(pattern: number): number {
  const normalized = pattern >>> 0;
  const existing = patternToCode.get(normalized);
  if (undefined !== existing)
    return existing;

  if (patterns.length >= maxLineCodeSlots) {
    // Exceeded maximum supported line patterns
    return 0;
  }

  const code = patterns.length;
  patterns.push(normalized);
  patternToCode.set(normalized, code);
  assignmentEvent.raiseEvent({ code, pattern: normalized });
  return code;
}

for (const pattern of defaultPatterns) {
  const normalized = normalizePatternValue(pattern);
  if (undefined !== normalized)
    assignCodeForPattern(normalized);
}

/** Map a LinePixels value to a texture row index that identifies the corresponding pattern. */
export function lineCodeFromLinePixels(pixels: LinePixels): number {
  const normalized = normalizePatternValue(pixels);
  if (undefined === normalized)
    return 0;

  return assignCodeForPattern(normalized);
}

/** @internal */
export function onLineCodeAssigned(listener: (args: LineCodeAssignmentArgs) => void): () => void {
  assignmentEvent.addListener(listener);
  return () => assignmentEvent.removeListener(listener);
}

/** @internal */
export function getLineCodePatterns(): readonly number[] {
  return patterns;
}

/** @internal */
export const lineCodeTextureSize = textureSize;

/** @internal */
export const lineCodeTextureCapacity = maxLineCodeSlots;
