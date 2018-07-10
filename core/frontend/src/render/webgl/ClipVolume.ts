/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ClipVector, ClipPlane, Transform } from "@bentley/geometry-core";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target, Clips } from "./Target";

// Types related to clipping.
export namespace Clip {
  // Interface adopted by a type which can apply a clipping volume to a Target.
  export interface Volume {
    // Push the clipping volume.
    push(exec: ShaderProgramExecutor): void;
    // Pop the clipping volume.
    pop(target: Target): void;
  }

  // A 3D clip volume defined by up to 6 planes.
  export class Planes implements Volume {
    private readonly _planes: ClipPlane[];

    public static create(clipVec: ClipVector): Planes | undefined {
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

      return new Planes(result);
    }

    public get length() { return undefined !== this._planes ? this._planes.length : 0; }
    public get isEmpty() { return 0 === this.length; }

    public push(exec: ShaderProgramExecutor) { this.apply(exec.target.clips, exec.target.viewMatrix); }
    public pop(target: Target) { target.clips.clear(); }

    public apply(clips: Clips, viewMatrix: Transform) { clips.setFrom(this._planes, viewMatrix); }

    private constructor(planes: ClipPlane[]) { this._planes = planes; }
  }

  // A 2D clip volume defined by any number of planes.
  class Mask implements Volume {
    public static create(_clipVector: ClipVector): Mask | undefined {
      // ###TODO: Requires ClipVector.boundingRange, ClipMaskGeometry, etc
      return undefined;
    }

    public push(_exec: ShaderProgramExecutor) { /* ###TODO */ }
    public pop(_target: Target) { /* ###TODO */ }
  }

  // Given a ClipVector, obtain an equivalent ClipVolume.
  export function getClipVolume(clipVector: ClipVector | undefined): Volume | undefined {
    let volume: Volume | undefined;
    if (undefined !== clipVector) {
      volume = Planes.create(clipVector);
      if (undefined === volume) {
        volume = Mask.create(clipVector);
      }
    }

    return volume;
  }
}
