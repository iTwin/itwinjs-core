/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { RenderMode } from "@itwin/core-common";
import { LUTGeometry } from "./CachedGeometry";
import { ColorInfo } from "./ColorInfo";
import { ShaderProgramParams } from "./DrawCommand";
import { FloatRgba } from "./FloatRGBA";
import { RenderPass } from "./RenderFlags";
import { Target } from "./Target";
import { MeshData } from "./MeshData";

/** Defines one aspect of the geometry of a mesh (surface or edges)
 * @internal
 */
export abstract class MeshGeometry extends LUTGeometry {
  public readonly mesh: MeshData;
  protected readonly _numIndices: number;

  public override get asMesh() { return this; }
  protected override _getLineWeight(params: ShaderProgramParams): number { return this.computeEdgeWeight(params); }

  // Convenience accessors...
  public get edgeWidth() { return this.mesh.edgeWidth; }
  public get edgeLineCode() { return this.mesh.edgeLineCode; }
  public override get hasFeatures() { return this.mesh.hasFeatures; }
  public get surfaceType() { return this.mesh.type; }
  public get fillFlags() { return this.mesh.fillFlags; }
  public get isPlanar() { return this.mesh.isPlanar; }
  public get colorInfo(): ColorInfo { return this.mesh.lut.colorInfo; }
  public get uniformColor(): FloatRgba | undefined { return this.colorInfo.isUniform ? this.colorInfo.uniform : undefined; }
  public get texture() { return this.mesh.texture; }
  public override get hasBakedLighting() { return this.mesh.hasBakedLighting; }
  public get hasFixedNormals() { return this.mesh.hasFixedNormals; }
  public get lut() { return this.mesh.lut; }
  public get hasScalarAnimation() { return this.mesh.lut.hasScalarAnimation; }

  protected constructor(mesh: MeshData, numIndices: number) {
    super(mesh.viewIndependentOrigin);
    this._numIndices = numIndices;
    this.mesh = mesh;
  }

  protected computeEdgeWeight(params: ShaderProgramParams): number {
    return params.target.computeEdgeWeight(params.renderPass, this.edgeWidth);
  }
  protected computeEdgeLineCode(params: ShaderProgramParams): number {
    return params.target.computeEdgeLineCode(params.renderPass, this.edgeLineCode);
  }
  protected computeEdgeColor(target: Target): ColorInfo {
    return target.computeEdgeColor(this.colorInfo);
  }
  protected computeEdgePass(target: Target): RenderPass {
    if (target.isDrawingShadowMap)
      return RenderPass.None;

    const vf = target.currentViewFlags;
    if (RenderMode.SmoothShade === vf.renderMode && !vf.visibleEdges) {
      return RenderPass.None;
    }

    // Only want translucent edges in wireframe mode.
    const isTranslucent = RenderMode.Wireframe === vf.renderMode && vf.transparency && this.colorInfo.hasTranslucency;
    return isTranslucent ? RenderPass.Translucent : RenderPass.OpaqueLinear;
  }
}
