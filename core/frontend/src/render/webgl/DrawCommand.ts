/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Matrix4 } from "./Matrix";
import { Target } from "./Target";
import { CachedGeometry } from "./CachedGeometry";
import { Transform } from "@bentley/geometry-core";
import { RenderPass } from "./RenderFlags";

export class ShaderProgramParams {
  public readonly target: Target;
  public readonly renderPass: RenderPass;
  public readonly projectionMatrix: Matrix4;

  public constructor(target: Target, pass: RenderPass) {
    this.target = target;
    this.renderPass = pass;
    /* ###TODO
    if (this.isViewCoords) {
      this.projectionMatrix = Matrix4.ortho(0.0, target.renderRect.width, target.renderRect.height, 0.0, -1.0, 1.0);
    } else {
      this.projectionMatrix = Matrix4.fromDMatrix4d(target.projectionMatrix);
    }
     */
    this.projectionMatrix = Matrix4.fromIdentity();
  }

  public get isViewCoords() { return RenderPass.ViewOverlay === this.renderPass || RenderPass.Background === this.renderPass; }
  public get isOverlayPass() { return RenderPass.WorldOverlay === this.renderPass || RenderPass.ViewOverlay === this.renderPass; }
  public get context() { return this.target.context; }
}

export class DrawParams extends ShaderProgramParams {
  public readonly geometry: CachedGeometry;
  public readonly modelViewMatrix: Matrix4;
  public readonly modelMatrix: Matrix4;

  public constructor(target: Target, geometry: CachedGeometry, modelMatrix: Transform, pass: RenderPass) {
    super(target, pass);
    this.geometry = geometry;
    this.modelMatrix = Matrix4.fromTransform(modelMatrix);
    // ###TODO if (this.isViewCoords) {
    // ###TODO } else {
    // ###TODO }
    this.modelViewMatrix = Matrix4.fromIdentity();
  }
}

export const enum PushOrPop {
  Push,
  Pop,
}

export const enum OpCode {
  DrawBatchPrimitive,
  DrawOvrPrimitive,
  PushBranch,
  PopBranch,
}
