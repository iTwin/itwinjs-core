/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { ThematicDisplaySensor, ThematicDisplaySensorSettings } from "@bentley/imodeljs-common";
import { Texture2DData, Texture2DHandle } from "./Texture";
import { GL } from "./GL";
import { System } from "./System";
import { WebGLDisposable } from "./Disposable";

/** @internal */
interface ThematicSensorsTexture {
  readonly handle: Texture2DHandle;
  readonly data: Texture2DData;
}

/** Maintains a texture representing a list of thematic sensors. ###TODO: Update when view matrix changes? See ClipVolume.ts
 * @internal
 */
export abstract class ThematicSensors implements WebGLDisposable {
  private readonly _texture: ThematicSensorsTexture;
  /** Used for writing to texture data. */
  private readonly _view: DataView;
  /** Position at which to write next texture data. */
  private _curPos: number = 0;

  public static create(sensorSettings: ThematicDisplaySensorSettings): ThematicSensors | undefined {
    const obj = System.instance.capabilities.supportsTextureFloat ? FloatSensors.create(sensorSettings) : PackedSensors.create(sensorSettings);
    if (obj !== undefined) {
      obj.update(sensorSettings.sensors);
    }
    return obj;
  }

  public get isDisposed(): boolean { return this._texture.handle.isDisposed; }

  public dispose(): void {
    dispose(this._texture.handle);
  }

  public get bytesUsed(): number { return this._texture.handle.bytesUsed; }

  public get texture(): Texture2DHandle { return this._texture.handle; }

  private update(sensors: ThematicDisplaySensor[]) {
    this.reset();

    for (const sensor of sensors) {
      const position = sensor.position;
      const value = sensor.value;

      // ###TODO: transform position from world space to eye space

      this.appendSensor(position, value);
    }

    this._texture.handle.replaceTextureData(this._texture.data);
    return this._texture.handle;
  }

  protected constructor(texture: ThematicSensorsTexture) {
    this._texture = texture;
    this._view = new DataView(texture.data.buffer);
  }

  protected abstract append(value: number): void;

  protected appendFloat(value: number): void { this._view.setFloat32(this._curPos, value, true); this.advance(4); }
  protected appendUint8(value: number): void { this._view.setUint8(this._curPos, value); this.advance(1); }

  private advance(numBytes: number): void { this._curPos += numBytes; }
  private reset(): void { this._curPos = 0; }

  private appendValues(a: number, b: number, c: number, d: number) {
    this.append(a);
    this.append(b);
    this.append(c);
    this.append(d);
  }

  private appendSensor(position: Point3d, value: number): void { this.appendValues(position.x, position.y, position.z, value); }
}

/** Stores thematic sensors in floating-point texture.
 * @internal
 */
class FloatSensors extends ThematicSensors {
  public static create(sensorSettings: ThematicDisplaySensorSettings): ThematicSensors | undefined {
    const totalNumSensors = sensorSettings.sensors.length;
    const data = new Float32Array(totalNumSensors * 4);
    const handle = Texture2DHandle.createForData(1, totalNumSensors, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new FloatSensors({ handle, data }) : undefined;
  }

  protected append(value: number) { this.appendFloat(value); }

  private constructor(texture: ThematicSensorsTexture) { super(texture); }
}

/** Stores clip planes packed into RGBA texture.
 * @internal
 */
class PackedSensors extends ThematicSensors {
  public static create(sensorSettings: ThematicDisplaySensorSettings): ThematicSensors | undefined {
    const totalNumSensors = sensorSettings.sensors.length;
    const data = new Uint8Array(totalNumSensors * 4 * 4);
    const handle = Texture2DHandle.createForData(4, totalNumSensors, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new PackedSensors({ handle, data }) : undefined;
  }

  protected append(value: number) {
    const sign = value < 0 ? 1 : 0;
    value = Math.abs(value);
    const exponent = Math.floor(Math.log10(value)) + 1;
    value = value / Math.pow(10, exponent);

    const bias = 38;
    let temp = value * 256;
    const b0 = Math.floor(temp);
    temp = (temp - b0) * 256;
    const b1 = Math.floor(temp);
    temp = (temp - b1) * 256;
    const b2 = Math.floor(temp);
    const b3 = (exponent + bias) * 2 + sign;

    this.appendUint8(b0);
    this.appendUint8(b1);
    this.appendUint8(b2);
    this.appendUint8(b3);
  }

  private constructor(texture: ThematicSensorsTexture) { super(texture); }
}
