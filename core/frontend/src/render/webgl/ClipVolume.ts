/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ClipVector, ClipPlane, Transform } from "@bentley/geometry-core";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target, Clips } from "./Target";

export class ClipPlanes {
  private readonly _planes: ClipPlane[];

  public static create(clipVec: ClipVector) : ClipPlanes | undefined {
    if (1 !== clipVec.clips.length) {
      return undefined;
    }

    const clipPrim = clipVec.clips[0];
    const clipPlanesRef = clipPrim.fetchClipPlanesRef();
    const convexClipPlaneSets = clipPlanesRef.convexSets;
    if (undefined === convexClipPlaneSets || 1 !== convexClipPlaneSets.length) {
      return undefined;
    }

    const planes = convexClipPlaneSets[0].planes;
    const clipCount = planes.length;
    if (0 === clipCount || clipCount > 6) {
      return undefined;
    }

    const result: ClipPlane[] = [];
    for (const plane of planes) {
      result.push(plane.clone());
    }

    return new ClipPlanes(result);
  }

  public get length() { return undefined !== this._planes ? this._planes.length : 0; }
  public get isEmpty() { return 0 === this.length; }

  public push(exec: ShaderProgramExecutor) { this.apply(exec.target.clips, exec.target.viewMatrix); }
  public pop(target: Target) { target.clips.clear(); }

  public apply(clips: Clips, viewMatrix: Transform) { clips.setFrom(this._planes, viewMatrix); }

  private constructor(planes: ClipPlane[]) { this._planes = planes; }
}

export type ClipVolume = ClipPlanes; // ###TODO | ClipMask
