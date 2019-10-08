/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */
import { Target } from "./Target";
import { TileTree } from "../../tile/TileTree";
import { Frustum, RenderMode, FrustumPlanes, Npc } from "@bentley/imodeljs-common";
import { Plane3dByOriginAndUnitNormal, Point3d, Range3d, Transform, Matrix3d, Matrix4d, Ray3d, Map4d, Range1d, Range2d, ConvexClipPlaneSet, ClipUtilities } from "@bentley/geometry-core";
import { RenderState } from "./RenderState";
import { ViewState3d } from "../../ViewState";
import { ViewFrustum } from "../../Viewport";
import { Matrix4 } from "./Matrix";

export class PlanarTextureProjection {
  private static _rayScratch = Ray3d.createXAxis();
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private static addPlaneRayIntersections(range: Range3d, textureTransform: Transform, frustumRay: Ray3d, lowPlane: Plane3dByOriginAndUnitNormal, highPlane: Plane3dByOriginAndUnitNormal) {
    const lowDistance = frustumRay.intersectionWithPlane(lowPlane);
    const intersectRange = Range1d.createNull(), paramRange = Range1d.createXX(0.0, 1.0);
    if (lowDistance !== undefined)
      intersectRange.extendX(lowDistance);
    if (lowPlane !== highPlane) {
      const highDistance = frustumRay.intersectionWithPlane(highPlane);
      if (highDistance !== undefined)
        intersectRange.extendX(highDistance);
    }
    intersectRange.intersect(paramRange, intersectRange);
    if (!intersectRange.isNull) {
      range.extend(textureTransform.multiplyPoint3d(frustumRay.fractionToPoint(intersectRange.low)));
      if (intersectRange.high > intersectRange.low)
        range.extend(textureTransform.multiplyPoint3d(frustumRay.fractionToPoint(intersectRange.high)));
    }
  }
  private static getFrustumPlaneIntersection(range: Range3d, textureTransform: Transform, plane: Plane3dByOriginAndUnitNormal, frustum: Frustum, heightRange?: Range1d) {
    const isSinglePlane = heightRange === undefined || (heightRange.high - heightRange.low) < 1.0E-4;
    const lowHeight = heightRange !== undefined ? heightRange.low : 0.0;
    const normal = plane.getNormalRef();
    const lowPlane = plane.clone();
    lowPlane.getOriginRef().addScaledInPlace(normal, lowHeight);
    let highPlane;
    if (isSinglePlane) {
      highPlane = lowPlane;
    } else {
      highPlane = lowPlane.clone();
      highPlane.getOriginRef().addScaledInPlace(normal, heightRange!.high - heightRange!.low);
    }
    const frustumIndices = [0, 1, 3, 2];
    for (let i = 0; i < 4; i++) {
      const index = frustumIndices[i];
      const nextIndex = frustumIndices[(i + 1) % 4];
      PlanarTextureProjection.addPlaneRayIntersections(range, textureTransform, Ray3d.createStartEnd(frustum.points[index + 4], frustum.points[index], PlanarTextureProjection._rayScratch), lowPlane, highPlane);
      PlanarTextureProjection.addPlaneRayIntersections(range, textureTransform, Ray3d.createStartEnd(frustum.points[index], frustum.points[nextIndex], PlanarTextureProjection._rayScratch), lowPlane, highPlane);
      PlanarTextureProjection.addPlaneRayIntersections(range, textureTransform, Ray3d.createStartEnd(frustum.points[4 + index], frustum.points[4 + nextIndex], PlanarTextureProjection._rayScratch), lowPlane, highPlane);
    }
  }

  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, viewFrustum: ViewFrustum, drapedTileTree: TileTree, drapeTileTree: TileTree, viewState: ViewState3d, textureWidth: number, textureHeight: number, heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4, debugFrustum?: Frustum, zValue?: number } {
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

    let tileRange, range = Range3d.createNull();
    const frustum = viewFrustum.getFrustum();

    tileRange = Range3d.createNull();
    const matrix = Matrix4d.createTransform(textureTransform);
    const viewPlanes = new FrustumPlanes(viewFrustum.getFrustum());
    drapedTileTree.accumulateTransformedRange(tileRange, matrix, viewPlanes);

    // The tile range here may further reduced by interesecting with the frustum planes.
    const convexClipPlanes = ConvexClipPlaneSet.createPlanes(viewPlanes.planes!);
    convexClipPlanes.transformInPlace(textureTransform);
    tileRange = ClipUtilities.rangeOfConvexClipPlaneSetIntersectionWithRange(convexClipPlanes, tileRange);

    if (drapedTileTree.loader.isContentUnbounded) {
      heightRange = Range1d.createXX(tileRange.xLow, tileRange.xHigh);

      PlanarTextureProjection.getFrustumPlaneIntersection(range, textureTransform, texturePlane, frustum, heightRange);
    } else {
      range = tileRange;
    }
    if (drapeTileTree.loader.isContentUnbounded) {
      range.low.x = Math.min(range.low.x, texturePlane.getOriginRef().z - 1.0);   // Assumes Z-drape -- needs to be generalized if we support others.
      range.high.x = Math.max(range.high.x, texturePlane.getOriginRef().z + 1.);
    } else {
      // In this case (classification) we don't know the drape geometry exists on the texture plane.
      // We expand the depth to include the drape geometry - but limit the area to intersection of drape with draped.
      const drapeRange = drapeTileTree.rootTile.computeWorldContentRange();
      if (!drapeRange.isNull) {
        textureTransform.multiplyRange(drapeRange, drapeRange);
        // Intersection of area.
        range.low.z = Math.max(range.low.z, drapeRange.low.z);
        range.low.y = Math.max(range.low.y, drapeRange.low.y);
        range.high.z = Math.min(range.high.z, drapeRange.high.z);
        range.high.y = Math.min(range.high.y, drapeRange.high.y);

        // Union of depths.
        range.low.x = Math.min(range.low.x, drapeRange.low.x - 1);
        range.high.x = Math.max(range.high.x, drapeRange.high.x) + 1;
      }
    }

    const yMargin = .001 * (range.high.y - range.low.y);
    range.low.y -= yMargin;
    range.high.y += yMargin;

    const textureFrustum = Frustum.fromRange(range);
    const debugFrustum = textureFrustum.clone();
    textureTransform.multiplyInversePoint3dArray(debugFrustum.points, debugFrustum.points);

    if (viewState.isCameraOn) {
      const textureEyePoint = viewState.getEyePoint().clone();
      textureTransform.multiplyPoint3d(textureEyePoint, textureEyePoint);
      const eyeHeight = (range.low.x + range.high.x) / 2.0;
      const eyePlane = Plane3dByOriginAndUnitNormal.create(Point3d.createScale(texturePlane.getNormalRef(), eyeHeight), texturePlane.getNormalRef());
      const projectionRay = Ray3d.create(viewState.getEyePoint(), viewZ.crossProduct(textureX).normalize()!);
      const projectionDistance = projectionRay.intersectionWithPlane(eyePlane!);
      const minNearToFarRatio = .01;
      if (undefined !== projectionDistance) {
        const eyePoint = textureTransform.multiplyPoint3d(projectionRay.fractionToPoint(projectionDistance));
        let near = eyePoint.z - range.high.z;
        let far = eyePoint.z - range.low.z;
        if (near / far < minNearToFarRatio) {
          // If the near-far ratio is less than minimum move the camera back.
          far = (range.high.z - range.low.z) / (1.0 - minNearToFarRatio);
          near = far * minNearToFarRatio;
          eyePoint.z = near + range.high.z;
        }
        const nearOverFar = near / far;
        const nearRange = Range2d.createXYXY(range.low.x, eyePoint.y + nearOverFar * (range.low.y - eyePoint.y), range.high.x, eyePoint.y + nearOverFar * (range.high.y - eyePoint.y));
        const farRange = Range2d.createXYXY(eyePoint.x + (eyePoint.x - range.low.x) / nearOverFar, range.low.y, eyePoint.x + (eyePoint.x - range.high.x) / nearOverFar, range.high.y);

        textureFrustum.points[Npc._000].set(farRange.low.x, farRange.low.y, eyePoint.z - far);
        textureFrustum.points[Npc._100].set(farRange.high.x, farRange.low.y, eyePoint.z - far);
        textureFrustum.points[Npc._010].set(farRange.low.x, farRange.high.y, eyePoint.z - far);
        textureFrustum.points[Npc._110].set(farRange.high.x, farRange.high.y, eyePoint.z - far);
        textureFrustum.points[Npc._001].set(nearRange.low.x, nearRange.low.y, eyePoint.z - near);
        textureFrustum.points[Npc._101].set(nearRange.high.x, nearRange.low.y, eyePoint.z - near);
        textureFrustum.points[Npc._011].set(nearRange.low.x, nearRange.high.y, eyePoint.z - near);
        textureFrustum.points[Npc._111].set(nearRange.high.x, nearRange.high.y, eyePoint.z - near);
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
