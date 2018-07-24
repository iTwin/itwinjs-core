/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ClipVector, ClipPlane, Transform, Point3d, ClipUtilities, Triangulator, PolyfaceBuilder, IndexedPolyfaceVisitor } from "@bentley/geometry-core";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target, Clips } from "./Target";
import { RenderClipVolume } from "../System";
import { QPoint3dList, Frustum, QParams3d } from "@bentley/imodeljs-common/lib/common";
import { ClipMaskGeometry } from "./CachedGeometry";
import { ViewRect } from "../../Viewport";
import { FrameBuffer } from "./FrameBuffer";
import { dispose } from "@bentley/bentleyjs-core/lib/Disposable";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { TextureHandle } from "./Texture";
import { GL } from "./GL";
import { System } from "./System";
import { RenderState } from "./RenderState";
import { DrawParams } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";

/** A 3D clip volume defined by up to 6 planes. */
export class ClipVolumePlanes extends RenderClipVolume {
  private readonly _planes: ClipPlane[];

  public static create(clipVec: ClipVector): ClipVolumePlanes | undefined {
    if (1 !== clipVec.clips.length) {
      return undefined;
    }

    const clipPrim = clipVec.clips[0];
    const clipPlanesRef = clipPrim.fetchClipPlanesRef();
    const convexClipPlaneSets = clipPlanesRef.convexSets;
    if (undefined === convexClipPlaneSets || 1 !== convexClipPlaneSets.length) {
      return undefined;
    }

    const planes = convexClipPlaneSets[0].planes;
    const clipCount = planes.length;
    if (0 === clipCount || clipCount > 6) {
      return undefined;
    }

    const result: ClipPlane[] = [];
    for (const plane of planes) {
      result.push(plane.clone());
    }

    return new ClipVolumePlanes(result);
  }

  public get length() { return undefined !== this._planes ? this._planes.length : 0; }
  public get isEmpty() { return 0 === this.length; }

  public dispose() { }
  public push(exec: ShaderProgramExecutor) { this.apply(exec.target.clips, exec.target.viewMatrix); }
  public pop(target: Target) { target.clips.clear(); }
  public apply(clips: Clips, viewMatrix: Transform) { clips.setFrom(this._planes, viewMatrix); }

  private constructor(planes: ClipPlane[]) { super(); this._planes = planes; }
}

/** A 2D clip volume defined by any number of planes. */
export class ClipMaskVolume implements RenderClipVolume {
  public readonly geometry: ClipMaskGeometry;
  public readonly frustum: Frustum;
  public readonly rect: ViewRect;
  private _texture?: TextureHandle;
  private _fbo?: FrameBuffer;

  private constructor(geometry: ClipMaskGeometry) {
    this.geometry = geometry;
    this.frustum = new Frustum();
    this.rect = new ViewRect(0, 0, 0, 0);
  }

  /** Create a new ClipVolume from a clip vector. */
  public static create(clipVec: ClipVector): ClipMaskVolume | undefined {
    const range = clipVec.boundingRange;
    if (range.isNull())
      return undefined;

    const pts: Point3d[] = [
      Point3d.create(range.low.x, range.low.y, 0),
      Point3d.create(range.high.x, range.low.y, 0),
      Point3d.create(range.high.x, range.high.y, 0),
      Point3d.create(range.low.x, range.high.y, 0),
    ];

    const clippedPolygonInsides = ClipUtilities.clipPolygonToClipVector(pts, clipVec);
    const indices: number[] = [];
    const vertices = QPoint3dList.createFrom([], QParams3d.fromRange(range));
    let indexOffset = 0;

    for (const clippedPolygon of clippedPolygonInsides) {
      const triangulatedPolygonGraph = Triangulator.earcutFromPoints(clippedPolygon);
      Triangulator.cleanupTriangulation(triangulatedPolygonGraph);
      const polyfaceBuilder = PolyfaceBuilder.create();
      polyfaceBuilder.addGraph(triangulatedPolygonGraph, false);
      const polyface = polyfaceBuilder.claimPolyface();

      const nPoints = polyface.pointCount;
      const pPoints = polyface.data.point;
      const pIndices = polyface.data.pointIndex;
      assert(nPoints !== 0);

      for (let i = 0; i < nPoints; i++)
        vertices.add(pPoints.getPoint3dAt(i));

      const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
      while (visitor.moveToNextFacet())
        for (let i = 0; i < 3; i++)
          pIndices.push(indexOffset + visitor.clientPointIndex(i));

      assert(pIndices.length > 0);
      indexOffset += pIndices.length;
    }

    if (indices.length === 0 || vertices.length === 0)
      return undefined;

    return new ClipMaskVolume(new ClipMaskGeometry(new Uint32Array(indices), vertices));
  }

  public get texture(): TextureHandle | undefined { return this._texture; }
  public get fbo(): FrameBuffer | undefined { return this._fbo; }

  public dispose() {
    this._texture = dispose(this._texture);
    this._fbo = dispose(this._fbo);
  }

  /** Push this clip mask texture onto the target of a program executor. */
  public push(shader: ShaderProgramExecutor) {
    if (this._texture !== undefined)
      shader.target.clipMask = this._texture;
  }

  /** Clear a target's clip mask, provided that this ClipMaskVolume's texture is not undefined. */
  public pop(target: Target) {
    if (target.is2d && this._texture !== undefined)
      target.clipMask = undefined;
  }

  /** Update the clip mask using the shader executor's target and return the resulting texture. */
  public getTexture(exec: ShaderProgramExecutor): TextureHandle | undefined {
    const target = exec.target;
    if (!target.is2d)
      return undefined;

    const frust = target.planFrustum;
    const rect = target.viewRect;
    const frustumChanged = !this.frustum.equals(frust);
    const textureChanged = this._texture === undefined || this.rect.width !== rect.width || this.rect.height !== rect.height;

    if (textureChanged) {
      this.dispose();
      this._texture = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      if (this._texture !== undefined)
        this._fbo = FrameBuffer.create([this._texture]);
    }

    this.rect.init(rect.left, rect.top, rect.right, rect.bottom);
    if (textureChanged || frustumChanged) {
      this.frustum.setFrom(frust);
      this.render(exec);
    }

    return this._texture;
  }

  public render(exec: ShaderProgramExecutor) {
    if (this._fbo === undefined)
      return;

    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    // Render clip geometry as a mask
    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      const prevState = System.instance.currentRenderState;
      const target = exec.target;
      System.instance.applyRenderState(state);

      const context = System.instance.context;
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);

      const params = new DrawParams(target, this.geometry, target.currentTransform, RenderPass.OpaqueGeneral);
      exec.drawInterrupt(params);

      // Restore previous render state
      System.instance.applyRenderState(prevState);
    });
  }
}
