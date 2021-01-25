/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { ThematicDisplaySensor, ThematicDisplaySensorSettings } from "@bentley/imodeljs-common";
import { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { System } from "./System";
import { Texture2DData, Texture2DHandle } from "./Texture";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { Target } from "./Target";

/** @internal */
interface ThematicSensorsTexture {
  readonly handle: Texture2DHandle;
  readonly data: Texture2DData;
}

/** Maintains a texture representing a list of thematic sensors.
 * @internal
 */
export abstract class ThematicSensors implements WebGLDisposable {
  private readonly _texture: ThematicSensorsTexture;
  /** Used for writing to texture data. */
  private readonly _view: DataView;
  /** Position at which to write next texture data. */
  private _curPos: number = 0;

  public readonly target: Target;
  public readonly range: Range3d;
  public readonly sensorSettings?: ThematicDisplaySensorSettings;

  public get numSensors(): number { return this._sensors.length; }

  private _sensors: ThematicDisplaySensor[];
  private readonly _viewMatrix = Transform.createIdentity();

  public matchesTarget(target: Target): boolean {
    return target === this.target && this.sensorSettings === target.plan.thematic?.sensorSettings;
  }

  public static create(target: Target, range: Range3d): ThematicSensors {
    let sensors: ThematicDisplaySensor[] = [];

    if (target.plan.thematic !== undefined) {
      sensors = _accumulateSensorsInRange(
        target.plan.thematic.sensorSettings.sensors,
        range,
        target.currentTransform,
        target.plan.thematic.sensorSettings.distanceCutoff);
    }

    const obj = System.instance.capabilities.supportsTextureFloat ? FloatSensors.createFloat(target, range, sensors) : PackedSensors.createPacked(target, range, sensors);
    obj._update(obj.target.uniforms.frustum.viewMatrix);
    return obj;
  }

  public get isDisposed(): boolean { return this._texture.handle.isDisposed; }

  public dispose(): void {
    dispose(this._texture.handle);
  }

  public bindNumSensors(uniform: UniformHandle): void {
    uniform.setUniform1i(this.numSensors);
  }

  public bindTexture(uniform: UniformHandle): void {
    this._texture.handle.bindSampler(uniform, TextureUnit.ThematicSensors);
  }

  public get bytesUsed(): number { return this._texture.handle.bytesUsed; }

  public get texture(): Texture2DHandle { return this._texture.handle; }

  private _update(viewMatrix: Transform) {
    this._viewMatrix.setFrom(viewMatrix);

    this.reset();

    for (const sensor of this._sensors) {
      const position = this._viewMatrix.multiplyPoint3d(sensor.position);
      this.appendSensor(position, sensor.value);
    }

    this._texture.handle.replaceTextureData(this._texture.data);
  }

  public update(viewMatrix: Transform) {
    if (!this._viewMatrix.isAlmostEqual(viewMatrix)) {
      this._update(viewMatrix);
    }
  }

  protected constructor(texture: ThematicSensorsTexture, target: Target, range: Range3d, sensors: ThematicDisplaySensor[]) {
    this.target = target;
    this.range = range;
    this.sensorSettings = target.plan.thematic?.sensorSettings;
    this._sensors = sensors;
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
  public static createFloat(target: Target, range: Range3d, sensors: ThematicDisplaySensor[]): ThematicSensors {
    const data = new Float32Array(sensors.length * 4);
    const handle = Texture2DHandle.createForData(1, sensors.length, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    assert(undefined !== handle);
    return new FloatSensors({ handle, data }, target, range, sensors);
  }

  protected append(value: number) { this.appendFloat(value); }

  private constructor(texture: ThematicSensorsTexture, target: Target, range: Range3d, sensors: ThematicDisplaySensor[]) {
    super(texture, target, range, sensors);
  }
}

/** Stores thematic sensors packed into RGBA texture.
 * @internal
 */
class PackedSensors extends ThematicSensors {
  public static createPacked(target: Target, range: Range3d, sensors: ThematicDisplaySensor[]): ThematicSensors {
    const data = new Uint8Array(sensors.length * 4 * 4);
    const handle = Texture2DHandle.createForData(4, sensors.length, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    assert(undefined !== handle);
    return new PackedSensors({ handle, data }, target, range, sensors);
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

  private constructor(texture: ThematicSensorsTexture, target: Target, range: Range3d, sensors: ThematicDisplaySensor[]) {
    super(texture, target, range, sensors);
  }
}

function _sensorRadiusAffectsRange(sensor: ThematicDisplaySensor, sensorRadius: number, range: Range3d) {
  const distance = range.distanceToPoint(sensor.position);
  return !(distance > sensorRadius);
}

const scratchRange = Range3d.createNull();

function _accumulateSensorsInRange(sensors: ThematicDisplaySensor[], range: Range3d, transform: Transform, distanceCutoff: number): ThematicDisplaySensor[] {
  const retSensors: ThematicDisplaySensor[] = [];

  transform.multiplyRange(range, scratchRange);

  for (const sensor of sensors) {
    const position = sensor.position;

    if (distanceCutoff <= 0 || _sensorRadiusAffectsRange(sensor, distanceCutoff, scratchRange)) {
      const value = sensor.value;
      retSensors.push(ThematicDisplaySensor.fromJSON({ position, value }));
    }
  }

  return retSensors;
}
