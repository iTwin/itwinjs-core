/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Rendering
 */

import {
  ClipUtilities, ConvexClipPlaneSet, GrowableXYZArray, Map4d, Matrix3d, Matrix4d, Plane3dByOriginAndUnitNormal, Point3d, Range1d, Range2d, Range3d,
  Ray3d, Transform,
} from "@bentley/geometry-core";
import { Frustum, FrustumPlanes, Npc, RenderMode } from "@bentley/imodeljs-common";
import { LengthDescription } from "../../properties/LengthDescription";
import { TileTreeReference } from "../../tile/internal";
import { ViewingSpace } from "../../ViewingSpace";
import { ViewState3d } from "../../ViewState";
import { RenderState } from "./RenderState";
import { Target } from "./Target";

export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);
  private static appendFrustumRangePoints(rangePoints: Point3d[], frustumPlanes: ConvexClipPlaneSet, range: Range3d) {

    ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(frustumPlanes, range, (points: GrowableXYZArray) => {
      for (const point of points.getPoint3dArray())
        rangePoints.push(point);
    }, true, true, false);
  }
  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, viewFrustum: ViewingSpace, drapedRef: TileTreeReference, drapeRefs: TileTreeReference[], viewState: ViewState3d, textureWidth: number, textureHeight: number, _heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4d, debugFrustum?: Frustum, zValue?: number } {
    const drapedTileTree = drapedRef.treeOwner.tileTree;
    let drapeUnbounded = false, drapeNotLoaded;

    if (undefined === drapedTileTree)
      return {};
    for (const drapeRef of drapeRefs) {
      const drapeTree = drapeRef.treeOwner.tileTree;
      if (!drapeTree)
        return {};
      drapeUnbounded = drapeUnbounded || drapeTree.isContentUnbounded;
    }

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
    const textureViewFrustum = viewFrustum.getFrustum().transformBy(textureTransform);
    const rangePoints = new Array<Point3d>();
    const viewPlanes = new FrustumPlanes(textureViewFrustum);
    const viewClipPlanes = ConvexClipPlaneSet.createPlanes(viewPlanes.planes!);
    const drapedContentRange = textureTransform.multiplyRange(drapedRef.computeWorldContentRange());
    const epsilon = .01;

    if (undefined === drapedContentRange)
      return {};

    this.appendFrustumRangePoints(rangePoints, viewClipPlanes, drapedContentRange);

    const drapeHeightRange = Range1d.createNull();

    for (const rangePoint of rangePoints)
      drapeHeightRange.extendX(rangePoint.x);

    if (drapeUnbounded) {
      drapeHeightRange.extendX(texturePlane.getOriginRef().z - epsilon);
      drapeHeightRange.extendX(texturePlane.getOriginRef().z + epsilon);
    } else {
      // In this case (classification) we don't know the drape geometry exists on the texture plane.
      // We expand the depth to include the drape geometry - but limit the area to intersection of drape with draped.
      let drapeRangeNull = true;
      for (const drapeRef of drapeRefs) {
        const drapeRange = drapeRef.computeWorldContentRange();
        if (!drapeRange.isNull) {
          drapeRangeNull = false;
          drapeHeightRange.extendX(drapeRange.low.z - epsilon);
          drapeHeightRange.extendX(drapeRange.high.z + epsilon);
        }

      }
      if (drapeRangeNull)
        return {};
    }

    const range = Range3d.createArray(rangePoints);
    range.low.x = Math.min(range.low.x, drapeHeightRange.low);
    range.high.x = Math.max(range.high.x, drapeHeightRange.high);
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
      const minNearToFarRatio = .01;  // Smaller value allows texture projection to conform tightly to view frustum.
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
        const farRange = Range2d.createNull();
        const nearRange = Range2d.createNull();
        // Create a frustum that includes the entire view frustum and all Z values.
        nearRange.low.x = drapeHeightRange.low;
        nearRange.high.x = drapeHeightRange.high;
        farRange.low.x = eyePoint.x + far / near * (drapeHeightRange.low - eyePoint.x);
        farRange.high.x = eyePoint.x + far / near * (drapeHeightRange.high - eyePoint.x);
        for (const rangePoint of rangePoints) {
          const farScale = far / (eyePoint.z - rangePoint.z);
          const nearScale = near / (eyePoint.z - rangePoint.z);
          const nearY = eyePoint.y + nearScale * (rangePoint.y - eyePoint.y);
          const farY = eyePoint.y + farScale * (rangePoint.y - eyePoint.y);
          nearRange.low.y = Math.min(nearRange.low.y, nearY);
          nearRange.high.y = Math.max(nearRange.high.y, nearY);
          farRange.low.y = Math.min(farRange.low.y, farY);
          farRange.high.y = Math.max(farRange.high.y, farY);
        }

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
    const npcToView = Map4d.createBoxMap(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), Point3d.create(0, 0, 0), Point3d.create(textureWidth, textureHeight, 1))!;
    const npcToWorld = worldToNpc.createInverse();
    if (undefined === npcToWorld) {
      return {};
    }
    const worldToNpcMap = Map4d.createRefs(worldToNpc, npcToWorld);
    const worldToViewMap = npcToView.multiplyMapMap(worldToNpcMap);

    return { textureFrustum, projectionMatrix: worldToNpc, worldToViewMap, debugFrustum };
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
