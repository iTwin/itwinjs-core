/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Matrix4d } from "@itwin/core-geometry";
import { UniformHandle } from "./UniformHandle";
import { Matrix4 } from "./Matrix";
import { desync, sync } from "./Sync";

/** Maintains uniform variable state associated with a Target's ViewRect.
 * @internal
 */
export class ViewRectUniforms {
  public syncKey = 0;
  public readonly projectionMatrix = Matrix4d.createIdentity();

  public readonly projectionMatrix32 = new Matrix4();
  private readonly _dimensions = [ 0, 0 ];
  private readonly _inverseDimensions = [ 0, 0 ];
  private readonly _viewportMatrix = new Matrix4();

  public update(width: number, height: number): void {
    if (width === this.width && height === this.height)
      return;

    desync(this);
    this._dimensions[0] = width;
    this._dimensions[1] = height;

    Matrix4.fromOrtho(0.0, width, height, 0.0, -1.0, 1.0, this.projectionMatrix32);
    this.projectionMatrix32.toMatrix4d(this.projectionMatrix);

    this._inverseDimensions[0] = 1 / width;
    this._inverseDimensions[1] = 1 / height;

    const nearDepthRange = 0.0;
    const farDepthRange = 1.0;
    const x = 0;
    const y = 0;

    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const halfDepth = (farDepthRange - nearDepthRange) * 0.5;

    const column0Row0 = halfWidth;
    const column1Row1 = halfHeight;
    const column2Row2 = halfDepth;
    const column3Row0 = x + halfWidth;
    const column3Row1 = y + halfHeight;
    const column3Row2 = nearDepthRange + halfDepth;
    const column3Row3 = 1.0;

    Matrix4.fromValues(
      column0Row0, 0.0, 0.0, column3Row0,
      0.0, column1Row1, 0.0, column3Row1,
      0.0, 0.0, column2Row2, column3Row2,
      0.0, 0.0, 0.0, column3Row3,
      this._viewportMatrix);
  }

  public get width() { return this._dimensions[0]; }
  public get height() { return this._dimensions[1]; }

  public bindProjectionMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix4(this.projectionMatrix32);
  }

  public bindDimensions(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform2fv(this._dimensions);
  }

  public bindInverseDimensions(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform2fv(this._inverseDimensions);
  }

  public bindViewportMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix4(this._viewportMatrix);
  }
}
