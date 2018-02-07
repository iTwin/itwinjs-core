/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export const enum FrustumUniformType {
  TwoDee,
  Orthographic,
  Perspective,
}

const enum Plane {
  kTop,
  kBottom,
  kLeft,
  kRight,
}

const enum FrustumData {
  kNear,
  kFar,
  kType,
}

export class FrustumUniforms {
  private planeData: Float32Array;
  private frustumData: Float32Array;
  public constructor() {
    const pData = [];
    pData[Plane.kTop] = 0.0;
    pData[Plane.kBottom] = 0.0;
    pData[Plane.kLeft] = 0.0;
    pData[Plane.kRight] = 0.0;
    const fData = [];
    fData[FrustumData.kNear] = 0.0;
    fData[FrustumData.kFar] = 0.0;
    fData[FrustumData.kType] = 0.0;
    this.planeData = new Float32Array(pData);
    this.frustumData = new Float32Array(fData);
  }
  public getFrustumPlanes(): Float32Array { return this.planeData; }
  public getFrustum(): Float32Array { return this.frustumData; }
  public getNearPlane(): number { return this.frustumData[FrustumData.kNear]; }
  public getFarPlane(): number { return this.frustumData[FrustumData.kFar]; }
  public GetType(): FrustumUniformType { return this.getFrustum()[FrustumData.kType] as FrustumUniformType; }
  public Is2d(): boolean { return FrustumUniformType.TwoDee === this.GetType(); }

  public SetPlanes(top: number, bottom: number, left: number, right: number): void {
    this.planeData[Plane.kTop] = top;
    this.planeData[Plane.kBottom] = bottom;
    this.planeData[Plane.kLeft] = left;
    this.planeData[Plane.kRight] = right;
  }
  public SetFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void {
    this.frustumData[FrustumData.kNear] = nearPlane;
    this.frustumData[FrustumData.kFar] = farPlane;
    this.frustumData[FrustumData.kType] = type as number;
  }
}
