/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */
import { Target } from "./Target";
import { TileTree } from "../../tile/TileTree";
import { Frustum, RenderMode, FrustumPlanes, Npc } from "@bentley/imodeljs-common";
import { Plane3dByOriginAndUnitNormal, Point3d, Range3d, Transform, Matrix3d, Matrix4d, Ray3d, Map4d, Range1d, Range2d } from "@bentley/geometry-core";
import { RenderState } from "./RenderState";
import { ViewState3d } from "../../ViewState";
import { ViewFrustum } from "../../Viewport";
import { Matrix4 } from "./Matrix";

export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private static getFrustumPlaneIntersection(intersectPoints: Point3d[], plane: Plane3dByOriginAndUnitNormal, frustum: Frustum, singleSided: boolean) {
    const intersect = new Point3d();

    for (let i = 0; i < 4; i++) {
      const frustumRay = Ray3d.createStartEnd(frustum.points[i + 4], frustum.points[i]);
      const intersectDistance = frustumRay.intersectionWithPlane(plane, intersect);
      if (intersectDistance !== undefined && intersectDistance >= 0.0 && intersectDistance <= 1.0)
        intersectPoints.push(intersect.clone());
    }
    if (singleSided) {
      for (const frustumPoint of frustum.points) {
        if (plane.altitude(frustumPoint) >= 0.0)
          intersectPoints.push(frustumPoint.clone());
      }
    }
  }

  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, viewFrustum: ViewFrustum, tileTree: TileTree, viewState: ViewState3d, textureWidth: number, textureHeight: number, heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4, debugFrustum?: Frustum } {
    const textureZ = texturePlane.getNormalRef();
    // const textureDepth = textureZ.dotProduct(texturePlane.getOriginRef());
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

    let tileRange;
    const frustum = viewFrustum.getFrustum();

    tileRange = Range3d.createNull();
    const matrix = Matrix4d.createTransform(textureTransform);
    const viewPlanes = new FrustumPlanes(viewFrustum.getFrustum());
    tileTree.accumulateTransformedRange(tileRange, matrix, viewPlanes);

    heightRange = Range1d.createXX(tileRange.xLow, tileRange.xHigh);

    const rangePoints = new Array<Point3d>();
    const doVolume = heightRange !== undefined && (heightRange.high - heightRange.low) > 1.0E-4;
    const baseHeight = heightRange !== undefined ? heightRange.low : 0.0;
    const normal = texturePlane.getNormalRef();
    const intersectPlane = texturePlane.clone();
    intersectPlane.getOriginRef().addScaledInPlace(normal, baseHeight);
    PlanarTextureProjection.getFrustumPlaneIntersection(rangePoints, intersectPlane, frustum, doVolume);
    if (doVolume) {
      intersectPlane.getOriginRef().addScaledInPlace(normal, heightRange.high - heightRange.low);
      intersectPlane.getNormalRef().negate(intersectPlane.getNormalRef());
      PlanarTextureProjection.getFrustumPlaneIntersection(rangePoints, texturePlane, frustum, true);
    }
    textureTransform.multiplyPoint3dArrayInPlace(rangePoints);
    const range = Range3d.createArray(rangePoints);

    if (tileRange && !tileTree.loader.isContentUnbounded)
      range.intersect(tileRange, range);

    const textureFrustum = Frustum.fromRange(range);
    const debugFrustum = textureFrustum.clone();
    textureTransform.multiplyInversePoint3dArray(debugFrustum.points, debugFrustum.points);

    if (viewState.isCameraOn) {
      const eyeHeight = (range.low.x + range.high.x) / 2.0;
      const eyePlane = Plane3dByOriginAndUnitNormal.create(Point3d.createScale(texturePlane.getNormalRef(), eyeHeight), texturePlane.getNormalRef());
      const projectionRay = Ray3d.create(viewState.getEyePoint(), viewZ.crossProduct(textureX).normalize()!);
      const projectionDistance = projectionRay.intersectionWithPlane(eyePlane!);
      const minFrontToRearRadio = .01;
      if (undefined !== projectionDistance) {
        const eyePoint = textureTransform.multiplyPoint3d(projectionRay.fractionToPoint(projectionDistance));
        let near = eyePoint.z - range.high.z;
        let far = eyePoint.z - range.low.z;
        if (near / far < minFrontToRearRadio) {
          // If the near-far ratio is less than minimum move the camera back.
          near = minFrontToRearRadio * far;
          eyePoint.z = near + range.high.z;
          far = eyePoint.z - range.low.z;
        }
        const farRange = Range2d.createNull();
        const nearRange = Range2d.createNull();
        // Create a frustum that includes the entire view frustum and all Z values.
        for (const rangePoint of rangePoints) {
          const farScale = far / (eyePoint.z - rangePoint.z);
          const nearScale = near / (eyePoint.z - rangePoint.z);
          farRange.extendXY((rangePoint.x - eyePoint.x) * far / near, farScale * (rangePoint.y - eyePoint.y));
          nearRange.extendXY((rangePoint.x - eyePoint.x), nearScale * (rangePoint.y - eyePoint.y));
        }

        textureFrustum.points[Npc._000].set(farRange.low.x, farRange.low.y, -far);
        textureFrustum.points[Npc._100].set(farRange.high.x, farRange.low.y, -far);
        textureFrustum.points[Npc._010].set(farRange.low.x, farRange.high.y, -far);
        textureFrustum.points[Npc._110].set(farRange.high.x, farRange.high.y, -far);
        textureFrustum.points[Npc._001].set(nearRange.low.x, nearRange.low.y, -near);
        textureFrustum.points[Npc._101].set(nearRange.high.x, nearRange.low.y, -near);
        textureFrustum.points[Npc._011].set(nearRange.low.x, nearRange.high.y, -near);
        textureFrustum.points[Npc._111].set(nearRange.high.x, nearRange.high.y, -near);

        for (const point of textureFrustum.points)
          point.addInPlace(eyePoint);
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

    return { textureFrustum, projectionMatrix, worldToViewMap, debugFrustum };
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
