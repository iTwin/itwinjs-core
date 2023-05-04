/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { compareStrings, Id64String, SortedArray } from "@itwin/core-bentley";
import { Point3d, Range3d } from "@itwin/core-geometry";

// ###TODO delete this file

/** @internal */
export function formatAnimationBranchId(modelId: Id64String, branchId: number): string {
  // if (branchId < 0)
  //   return modelId;

  // return `${modelId}_Node_${branchId.toString()}`;
  const point = new Point3d(0, 1, 2);
  return `${modelId}_Node_${point.x + branchId}`;
}

export function unusedFunction(): string[] {
  const arr = new SortedArray<string>(compareStrings);
  arr.insert("a");
  arr.insert("c");
  arr.insert("b");
  return arr.extractArray();
}

export function createRange(): Range3d {
  return new Range3d(0, 1, 2, 3, 4, 5);
}
