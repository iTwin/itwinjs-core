/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Logger, assert, dispose } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { ThematicDisplaySensor, ThematicDisplaySensorSettings } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { Texture2DData, Texture2DHandle } from "./Texture";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { Target } from "./Target";

/** @internal */
interface ThematicSensorsTexture {
  readonly handle: Texture2DHandle;
  readonly data: Texture2DData;
}

/** Maintains a floating-point texture representing a list of thematic sensors.
 * @internal
 */
export class ThematicSensors implements WebGLDisposable {
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

    Logger.logInfo("ThematicSensors", JSON.stringify(range));

    if (target.plan.thematic !== undefined) {
      sensors = _accumulateSensorsInRange(
        target.plan.thematic.sensorSettings.sensors,
        range,
        target.currentTransform,
        target.plan.thematic.sensorSettings.distanceCutoff);
    }

    const obj = this.createFloat(target, range, sensors);
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

  public static createFloat(target: Target, range: Range3d, sensors: ThematicDisplaySensor[]): ThematicSensors {
    const data = new Float32Array(sensors.length * 4);
    const handle = Texture2DHandle.createForData(1, sensors.length, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    assert(undefined !== handle);
    return new this({ handle, data }, target, range, sensors);
  }

  protected append(value: number) { this.appendFloat(value); }

  protected appendFloat(value: number): void {
    this._view.setFloat32(this._curPos, value, true);
    this.advance(4);
  }

  protected appendUint8(value: number): void {
    this._view.setUint8(this._curPos, value);
    this.advance(1);
  }

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
