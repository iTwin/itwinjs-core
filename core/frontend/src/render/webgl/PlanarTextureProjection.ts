/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */
import { Target } from "./Target";
import { TileTree } from "../../tile/TileTree";
import { Frustum, Npc, RenderMode } from "@bentley/imodeljs-common";
import { Plane3dByOriginAndUnitNormal, Point3d, Range3d, Transform, Matrix3d, Matrix4d, Ray3d, Map4d, Range1d } from "@bentley/geometry-core";
import { RenderState } from "./RenderState";
import { ViewState3d } from "../../ViewState";
import { ViewFrustum } from "../../Viewport";
import { Matrix4 } from "./Matrix";

export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private static extendRangeForFrustumPlaneIntersection(range: Range3d, texturePlane: Plane3dByOriginAndUnitNormal, textureTransform: Transform, frustum: Frustum, height: number) {
    const intersect = new Point3d();
    let includeHorizon = false;
    const plane = Plane3dByOriginAndUnitNormal.create(Point3d.createScale(texturePlane.getNormalRef(), height), texturePlane.getNormalRef())!;

    for (let i = 0; i < 4; i++) {
      const frustumRay = Ray3d.createStartEnd(frustum.points[i + 4], frustum.points[i]);
      const intersectDistance = frustumRay.intersectionWithPlane(plane, intersect);
      if (intersectDistance !== undefined && (frustum.getFraction() === 1.0 || intersectDistance > 0.0)) {
        range.extendTransformedPoint(textureTransform, intersect);
      } else includeHorizon = true;
    }
    if (includeHorizon) {
      for (let i = 0; i < 8; i++)
        range.extendTransformedPoint(textureTransform, frustum.points[i]);
    }
  }
  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, viewFrustum: ViewFrustum, tileTree: TileTree, viewState: ViewState3d, textureWidth: number, textureHeight: number, heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4 } {
    const textureZ = texturePlane.getNormalRef();
    const textureDepth = textureZ.dotProduct(texturePlane.getOriginRef());
    const viewX = viewFrustum.rotation.rowX();
    const viewZ = viewFrustum.rotation.rowZ();
    const minCrossMagnitude = 1.0E-4;

    if (viewZ === undefined)
      return {};      // View without depth?....

    let textureX = viewZ.crossProduct(textureZ);
    let textureY;
    if (textureX.magnitude() < minCrossMagnitude) {
      textureY = viewX.crossProduct(textureZ);
      textureX = textureY.crossProduct(textureZ).normalize()!;
    } else {
      textureX.normalizeInPlace();
      textureY = textureZ.crossProduct(textureX).normalize()!;
    }

    const frustumX = textureZ, frustumY = textureX, frustumZ = textureY;
    const textureMatrix = Matrix3d.createRows(frustumX, frustumY, frustumZ);
    const textureTransform = Transform.createRefs(Point3d.createZero(), textureMatrix);

    const range = Range3d.createNull();
    const frustum = new Frustum();
    viewFrustum.worldToNpcMap.transform1.multiplyPoint3dArrayQuietNormalize(frustum.points);

    PlanarTextureProjection.extendRangeForFrustumPlaneIntersection(range, texturePlane, textureTransform, frustum, heightRange ? heightRange.low : 0.0);
    if (heightRange)
      PlanarTextureProjection.extendRangeForFrustumPlaneIntersection(range, texturePlane, textureTransform, frustum, heightRange.high);

    if (!tileTree.isBackgroundMap) {
      // TBD... intersecting the range of the tile tree may reduce the projected area and improve fidelity for planar classifiers.
    }

    range.low.x = Math.min(range.low.x, textureDepth - .0001);    // Always include classification plane.
    range.high.x = Math.max(range.high.x, textureDepth + .0001);

    const textureFrustum = Frustum.fromRange(range);
    if (viewState.isCameraOn) {
      const projectionRay = Ray3d.create(viewState.getEyePoint(), viewZ.crossProduct(textureX).normalize()!);
      const projectionDistance = projectionRay.intersectionWithPlane(texturePlane);
      if (undefined !== projectionDistance) {
        const eyePoint = textureTransform.multiplyPoint3d(projectionRay.fractionToPoint(projectionDistance));
        const near = Math.max(.01, eyePoint.z - range.high.z);
        const far = eyePoint.z - range.low.z;
        const minFraction = 1.0 / 10.0;
        const fraction = Math.max(minFraction, near / far);
        for (let i = Npc.LeftBottomFront; i <= Npc.RightTopFront; i++) {
          const frustumPoint = textureFrustum.points[i];
          frustumPoint.x = eyePoint.x + (frustumPoint.x - eyePoint.x) * fraction;
          frustumPoint.y = eyePoint.y + (frustumPoint.y - eyePoint.y) * fraction;
        }
      }
    }
    textureMatrix.transposeInPlace();
    textureMatrix.multiplyVectorArrayInPlace(textureFrustum.points);
    const frustumMap = textureFrustum.toMap4d();
    if (undefined === frustumMap) {
      return {};
    }
    const worldToNpc = PlanarTextureProjection._postProjectionMatrixNpc.multiplyMatrixMatrix(frustumMap.transform0);
    const projectionMatrix = new Matrix4();
    projectionMatrix.initFromMatrix4d(worldToNpc);
    const npcToView = Map4d.createBoxMap(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), Point3d.create(0, 0, 0), Point3d.create(textureWidth, textureHeight, 1))!;
    const npcToWorld = worldToNpc.createInverse();
    if (undefined === npcToWorld) {
      return {};
    }
    const worldToNpcMap = Map4d.createRefs(worldToNpc, npcToWorld);
    const worldToViewMap = npcToView.multiplyMapMap(worldToNpcMap);

    return { textureFrustum, projectionMatrix, worldToViewMap };
  }
  public static getTextureDrawingParams(target: Target) {
    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    const viewFlags = target.currentViewFlags.clone();
    viewFlags.renderMode = RenderMode.SmoothShade;
    viewFlags.transparency = false;
    viewFlags.textures = false;
    viewFlags.lighting = false;
    viewFlags.shadows = false;
    viewFlags.noGeometryMap = true;
    viewFlags.monochrome = false;
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    return { state, viewFlags };
  }
}
