/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Point3d, Vector3d } from "@bentley/geometry-core";

const lightSize = 12; // number of floats in a ShaderLight definition

export class ShaderLight {
  private _data: Float32Array;
  public constructor(data: Float32Array, ndx: number) {
    this._data = new Float32Array(data.buffer, ndx * lightSize * 4, 12);
  }
  public get data(): Float32Array { return this._data; }
  public setColor(red: number, green: number, blue: number): void { this._data[0] = red; this._data[1] = green; this._data[2] = blue; }
  public setAtten1(atten: number): void { this._data[3] = atten; }
  public setCamSpcPos(pos: Point3d): void { this._data[4] = pos.x; this._data[5] = pos.y; this._data[6] = pos.z; }
  public setCosHTheta(cosHTheta: number): void { this._data[7] = cosHTheta; }
  public setCamSpcDir(dir: Vector3d): void { this._data[4] = dir.x; this._data[5] = dir.y; this._data[6] = dir.z; }
  public setCosHPhi(cosHPhi: number): void { this._data[7] = cosHPhi; }
}

export class ShaderLights {
  private _data: Float32Array;
  constructor(numLights: number) {
    this._data = new Float32Array(numLights * lightSize);
    for (let i = 0; i < this._data.length; ++i) {
      this._data[i] = 0;
    }
  }
  public shaderLight(ndx: number): ShaderLight | undefined {
    if (undefined === this._data || ndx >= this._data.length)
      return undefined;
    return new ShaderLight(this._data, ndx);
  }
  public get data(): Float32Array { return this._data; }
  public get numLights(): number { return this._data.length; }
}
