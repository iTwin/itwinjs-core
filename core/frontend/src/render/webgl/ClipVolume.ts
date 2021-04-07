/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import {
  ClipVector, Point3d, Transform, UnionOfConvexClipPlaneSets, Vector3d,
} from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { RenderClipVolume } from "../RenderClipVolume";
import { RenderMemory } from "../RenderMemory";
import { WebGLDisposable } from "./Disposable";
import { FloatRgba } from "./FloatRGBA";
import { GL } from "./GL";
import { System } from "./System";
import { Texture2DData, Texture2DHandle } from "./Texture";

/** @internal */
interface ClipPlaneSets {
  readonly unions: UnionOfConvexClipPlaneSets[];
  readonly numPlanes: number;
}

/** @internal */
interface ClipPlaneTexture {
  readonly handle: Texture2DHandle;
  readonly data: Texture2DData;
}

/** Maintains a texture representing clipping planes. Updated when view matrix changes.
 * @internal
 */
abstract class ClippingPlanes implements WebGLDisposable {
  /** Most recently-applied view matrix. */
  private readonly _transform = Transform.createZero();
  private readonly _texture: ClipPlaneTexture;
  private readonly _planes: ClipPlaneSets;
  /** Used for writing to texture data. */
  private readonly _view: DataView;
  /** Position at which to write next texture data. */
  private _curPos: number = 0;

  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    return System.instance.capabilities.supportsTextureFloat ? FloatPlanes.create(planes) : PackedPlanes.create(planes);
  }

  public get isDisposed(): boolean { return this._texture.handle.isDisposed; }

  public dispose(): void {
    dispose(this._texture.handle);
  }

  public get texture(): Texture2DHandle {
    return this._texture.handle;
  }

  public get bytesUsed(): number {
    return this._texture.handle.bytesUsed;
  }

  public get numPlanes(): number {
    return this._planes.numPlanes;
  }

  public getTexture(transform: Transform): Texture2DHandle {
    if (transform.isAlmostEqual(this._transform))
      return this._texture.handle;

    this.reset();
    transform.clone(this._transform);

    // Avoid allocations inside loop...
    const pInwardNormal = new Vector3d();
    const dir = new Vector3d();
    const pos = new Point3d();
    const v0 = new Vector3d();

    for (let i = 0; i < this._planes.unions.length; i++) {
      if (i > 0)
        this.appendUnionBoundary();

      const union = this._planes.unions[i];
      for (let j = 0; j < union.convexSets.length; j++) {
        const set = union.convexSets[j];
        if (0 === set.planes.length)
          continue;

        if (j > 0)
          this.appendSetBoundary();

        for (const plane of set.planes) {
          plane.inwardNormalRef.clone(pInwardNormal);
          let pDistance = plane.distance;

          // Transform direction of clip plane
          const norm = pInwardNormal;
          transform.matrix.multiplyVector(norm, dir);
          dir.normalizeInPlace();

          // Transform distance of clip plane
          transform.multiplyPoint3d(norm.scale(pDistance, v0), pos);
          v0.setFromPoint3d(pos);

          pInwardNormal.set(dir.x, dir.y, dir.z);
          pDistance = -v0.dotProduct(dir);

          // The plane has been transformed into view space
          this.appendPlane(pInwardNormal, pDistance);
        }
      }
    }

    this._texture.handle.replaceTextureData(this._texture.data);
    return this._texture.handle;
  }

  /** Exposed for testing purposes. */
  public getTextureData(transform: Transform): Texture2DData {
    this.getTexture(transform);
    return this._texture.data;
  }

  protected constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) {
    this._texture = texture;
    this._planes = planes;
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

  private appendPlane(normal: Vector3d, distance: number): void { this.appendValues(normal.x, normal.y, normal.z, distance); }
  private appendSetBoundary(): void { this.appendValues(0, 0, 0, 0); }
  private appendUnionBoundary(): void { this.appendValues(2, 2, 2, 0); }
}

/** Stores clip planes in floating-point texture.
 * @internal
 */
class FloatPlanes extends ClippingPlanes {
  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    const data = new Float32Array(planes.numPlanes * 4);
    const handle = Texture2DHandle.createForData(1, planes.numPlanes, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new FloatPlanes(planes, { handle, data }) : undefined;
  }

  protected append(value: number) { this.appendFloat(value); }

  private constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) { super(planes, texture); }
}

/** Stores clip planes packed into RGBA texture.
 * @internal
 */
class PackedPlanes extends ClippingPlanes {
  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    const data = new Uint8Array(planes.numPlanes * 4 * 4);
    const handle = Texture2DHandle.createForData(4, planes.numPlanes, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new PackedPlanes(planes, { handle, data }) : undefined;
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

  private constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) { super(planes, texture); }
}

/** A 3D clip volume defined as a texture derived from a set of planes.
 * @internal
 */
export class ClipVolume extends RenderClipVolume implements RenderMemory.Consumer, WebGLDisposable {
  private _planes?: ClippingPlanes; // not read-only because dispose()...
  private _outsideRgba: FloatRgba = FloatRgba.from(0.0, 0.0, 0.0, 0.0); // 0 alpha means disabled
  private _insideRgba: FloatRgba = FloatRgba.from(0.0, 0.0, 0.0, 0.0); // 0 alpha means disabled

  public get insideRgba(): FloatRgba {
    return this._insideRgba;
  }

  public get outsideRgba(): FloatRgba {
    return this._outsideRgba;
  }

  public get numPlanes(): number {
    return this._planes?.numPlanes ?? 0;
  }

  private constructor(clip: ClipVector, planes?: ClippingPlanes) {
    super(clip);
    this._planes = planes;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._planes)
      stats.addClipVolume(this._planes.bytesUsed);
  }

  /** Create a new ClipVolume from a ClipVector; or undefined if no clip planes could be extracted. */
  public static create(clipVec: ClipVector): ClipVolume | undefined {
    if (0 === clipVec.clips.length)
      return undefined;

    const unions = [];
    let numPlanes = 0;
    for (const primitive of clipVec.clips) {
      const union = primitive.fetchClipPlanesRef();
      if (undefined === union)
        continue;

      let numSets = 0;
      for (const set of union.convexSets) {
        const setLength = set.planes.length;
        if (setLength > 0) {
          ++numSets;
          numPlanes += setLength;
        }
      }

      if (numSets > 0) {
        unions.push(union);
        numPlanes += (numSets - 1);
      }
    }

    if (0 === unions.length)
      return undefined;

    numPlanes += (unions.length - 1);
    const planes = ClippingPlanes.create({ unions, numPlanes });
    return new ClipVolume(clipVec, planes);
  }

  public get isDisposed(): boolean { return undefined === this._planes; }

  public dispose() {
    this._planes = dispose(this._planes);
  }

  public setClipColors(outsideColor: ColorDef | undefined, insideColor: ColorDef | undefined) {
    if (outsideColor !== undefined) {
      this._outsideRgba = FloatRgba.fromColorDef(outsideColor);
      this._outsideRgba.alpha = 1.0;
    } else
      this._outsideRgba.alpha = 0.0;

    if (insideColor !== undefined) {
      this._insideRgba = FloatRgba.fromColorDef(insideColor);
      this._insideRgba.alpha = 1.0;
    } else
      this._insideRgba.alpha = 0.0;
  }

  public get hasOutsideClipColor(): boolean {
    return 0.0 !== this._outsideRgba.alpha;
  }

  public syncWithView(viewMatrix: Transform): boolean {
    return undefined !== this.getTexture(viewMatrix);
  }

  public get texture(): Texture2DHandle | undefined {
    return this._planes?.texture;
  }

  public getTexture(viewMatrix: Transform): Texture2DHandle | undefined {
    return this._planes?.getTexture(viewMatrix);
  }

  /** Exposed for testing purposes. */
  public getTextureData(transform = Transform.identity): Float32Array | Uint8Array | undefined {
    return undefined !== this._planes ? this._planes.getTextureData(transform) : undefined;
  }
}

const scratch = {
  normal: new Vector3d(),
  dir: new Vector3d(),
  pos: new Point3d(),
  v0: new Vector3d(),
};

/** Maintains an ArrayBuffer to serve as texture data for a ClipVector.
 * The clip planes are in view coordinates, so the data must be updated whenever the view
 * matrix changes.
 */
class BlipPlanesBuffer {
  /** Most recently-applied view matrix. */
  private readonly _viewMatrix = Transform.createZero();
  /** For writing to the ArrayBuffer. */
  private readonly _view: DataView;
  /** For inspecting the data in the ArrayBuffer. */
  private readonly _data: Uint8Array;
  /** The current write position. */
  private _curPos = 0;
  private readonly _clips: UnionOfConvexClipPlaneSets[];
  private readonly _append: (value: number) => void;
  /** The number of rows of data. Each row corresponds to a clipping plane, or to mark a boundary between two ClipPlaneSets or UnionOfConvexClipPlaneSets.
   * The final row is *always* a union boundary, to enable multiple clips to be concatenated - this is how nested clip volumes work.
   */
  public readonly numRows: number;

  public getData(viewMatrix: Transform): Uint8Array {
    if (!viewMatrix.isAlmostEqual(this._viewMatrix))
      this.updateData(viewMatrix);

    return this._data;
  }

  public get byteLength(): number {
    return this._view.buffer.byteLength;
  }

  public static create(clips: UnionOfConvexClipPlaneSets[], numRows: number): BlipPlanesBuffer {
    assert(numRows > 1); // at least one plane, plus a union boundary.
    return new BlipPlanesBuffer(clips, numRows);
  }

  private constructor(clips: UnionOfConvexClipPlaneSets[], numRows: number) {
    this._data = new Uint8Array(numRows * 4 * 4);
    this._view = new DataView(this._data.buffer);
    this._clips = clips;
    this.numRows = numRows;

    if (System.instance.capabilities.supportsTextureFloat)
      this._append = (value: number) => this.appendFloat(value);
    else
      this._append = (value: number) => this.appendEncodedFloat(value);
  }

  private appendFloat(value: number): void {
    this._view.setFloat32(this._curPos, value, true);
    this.advance(4);
  }

  private appendUint8(value: number): void {
    this._view.setUint8(this._curPos, value);
    this.advance(1);
  }

  private appendValues(a: number, b: number, c: number, d: number): void {
    this._append(a);
    this._append(b);
    this._append(c);
    this._append(d);
  }

  private appendPlane(normal: Vector3d, distance: number): void {
    this.appendValues(normal.x, normal.y, normal.z, distance);
  }

  private appendSetBoundary(): void {
    this.appendValues(0, 0, 0, 0);
  }

  private appendUnionBoundary(): void {
    this.appendValues(2, 2, 2, 0);
  }

  private appendEncodedFloat(value: number) {
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

  private advance(numBytes: number): void {
    this._curPos += numBytes;
  }

  private reset(): void {
    this._curPos = 0;
  }

  private updateData(transform: Transform): void {
    this.reset();
    transform.clone(this._viewMatrix);

    const { normal, dir, pos, v0 } = { ...scratch };
      for (let i = 0; i < this._clips.length; i++) {
        const clip = this._clips[i];
        for (let j = 0; j < clip.convexSets.length; j++) {
          const set = clip.convexSets[j];
          if (0 === set.planes.length)
            continue;

          if (j > 0)
            this.appendSetBoundary();

          for (const plane of set.planes) {
            plane.inwardNormalRef.clone(normal);
            let distance = plane.distance;

            const norm = normal;
            transform.matrix.multiplyVector(norm, dir);
            dir.normalizeInPlace();

            transform.multiplyPoint3d(norm.scale(distance, v0), pos);
            v0.setFromPoint3d(pos);

            normal.set(dir.x, dir.y, dir.z);
            distance = -v0.dotProduct(dir);
            this.appendPlane(normal, distance);
          }
        }

        this.appendUnionBoundary();
      }
  }
}

/** A ClipVector encoded for transmission to the GPU as a texture.
 * @internal
 */
export class BlipVolume extends RenderClipVolume {
  private readonly _buffer: BlipPlanesBuffer;

  public get numRows(): number {
    return this._buffer.numRows;
  }

  public get byteLength(): number {
    return this._buffer.byteLength;
  }

  public getData(viewMatrix: Transform): Uint8Array {
    return this._buffer.getData(viewMatrix);
  }

  public static create(clip: ClipVector): BlipVolume | undefined {
    if (!clip.isValid)
      return undefined;

    // Compute how many rows of data we need.
    const unions = [];
    let numRows = 0;
    for (const primitive of clip.clips) {
      const union = primitive.fetchClipPlanesRef();
      if (!union)
        continue;

      let numSets = 0;
      for (const set of union.convexSets) {
        const setLength = set.planes.length;
        if (setLength > 0) {
          ++numSets;
          numRows += setLength;
        }
      }

      if (numSets > 0) {
        unions.push(union);
        numRows += numSets - 1; // Additional boundary rows between sets.
      }
    }

    if (unions.length === 0)
      return undefined;

    numRows += unions.length; // Additional boundary row after each union - *including* the last union.
    const buffer = BlipPlanesBuffer.create(unions, numRows);
    return new BlipVolume(clip, buffer);
  }

  private constructor(clip: ClipVector, buffer: BlipPlanesBuffer) {
    super(clip);
    this._buffer = buffer;
  }
}
