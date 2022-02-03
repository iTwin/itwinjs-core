/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import type { Matrix3, Matrix4 } from "./Matrix";
import type { SyncToken } from "./Sync";
import { System } from "./System";

const enum DataType {// eslint-disable-line no-restricted-syntax
  Undefined, // eslint-disable-line id-blacklist
  Mat3,
  Mat4,
  Float,
  FloatArray,
  Vec2,
  Vec3,
  Vec4,
  Int,
  IntArray,
  Uint,
}

/** A handle to the location of a uniform within a shader program
 * @internal
 */
export class UniformHandle {
  private readonly _location: WebGLUniformLocation;
  private _type: DataType = DataType.Undefined;
  private readonly _data: number[] = [];
  public syncToken?: SyncToken;

  private constructor(location: WebGLUniformLocation) { this._location = location; }

  public static create(program: WebGLProgram, name: string): UniformHandle {
    const location = System.instance.context.getUniformLocation(program, name);
    if (null === location)
      throw new Error(`uniform ${name} not found.`);

    return new UniformHandle(location);
  }

  private updateData(type: DataType, data: Float32Array | Int32Array | number[]): boolean {
    assert(DataType.Undefined !== type && DataType.Int !== type && DataType.Float !== type && DataType.Uint !== type);

    let updated = this._type !== type;
    if (updated) {
      this._type = type;
      if (this._data.length !== data.length)
        this._data.length = data.length;
    }

    for (let i = 0; i < data.length; i++) {
      const datum = data[i];
      updated = updated || this._data[i] !== datum;
      this._data[i] = datum;
    }

    return updated;
  }

  private updateDatum(type: DataType, datum: number): boolean {
    assert(DataType.Int === type || DataType.Uint === type || DataType.Float === type);

    // NB: Yes, calling data.length without actually changing the length shows up as a significant performance bottleneck...
    if (this._data.length !== 1)
      this._data.length = 1;

    const updated = this._type !== type || this._data[0] !== datum;
    this._type = type;
    this._data[0] = datum;

    return updated;
  }

  public setMatrix3(mat: Matrix3) {
    if (this.updateData(DataType.Mat3, mat.data))
      System.instance.context.uniformMatrix3fv(this._location, false, mat.data);
  }

  public setMatrix4(mat: Matrix4) {
    if (this.updateData(DataType.Mat4, mat.data))
      System.instance.context.uniformMatrix4fv(this._location, false, mat.data);
  }

  public setUniform1iv(data: Int32Array | number[]) {
    if (this.updateData(DataType.IntArray, data))
      System.instance.context.uniform1iv(this._location, data);
  }

  public setUniform1fv(data: Float32Array | number[]) {
    if (this.updateData(DataType.FloatArray, data))
      System.instance.context.uniform1fv(this._location, data);
  }

  public setUniform2fv(data: Float32Array | number[]) {
    if (this.updateData(DataType.Vec2, data))
      System.instance.context.uniform2fv(this._location, data);
  }

  public setUniform3fv(data: Float32Array | number[]) {
    if (this.updateData(DataType.Vec3, data))
      System.instance.context.uniform3fv(this._location, data);
  }

  public setUniform4fv(data: Float32Array | number[]) {
    if (this.updateData(DataType.Vec4, data))
      System.instance.context.uniform4fv(this._location, data);
  }

  public setUniform1i(data: number) {
    if (this.updateDatum(DataType.Int, data))
      System.instance.context.uniform1i(this._location, data);
  }

  public setUniform1f(data: number) {
    if (this.updateDatum(DataType.Float, data))
      System.instance.context.uniform1f(this._location, data);
  }

  public setUniform1ui(data: number) {
    if (this.updateDatum(DataType.Uint, data))
      (System.instance.context as WebGL2RenderingContext).uniform1ui(this._location, data);
  }

  public setUniformBitflags(data: number) {
    if (System.instance.capabilities.isWebGL2)
      this.setUniform1ui(data);
    else
      this.setUniform1f(data);
  }
}
