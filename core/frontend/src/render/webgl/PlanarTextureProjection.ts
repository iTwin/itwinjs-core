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
} from "@itwin/core-geometry";
import { Frustum, FrustumPlanes, Npc, RenderMode } from "@itwin/core-common";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { SceneContext } from "../../ViewContext";
import { Tile, TileTreeReference } from "../../tile/internal";
import { ViewState3d } from "../../ViewState";
import { RenderState } from "./RenderState";
import { Target } from "./Target";

const scratchRange = Range3d.createNull();
export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, sceneContext: SceneContext, target: { tiles: Tile[], location: Transform }, drapeRefs: TileTreeReference[], viewState: ViewState3d, textureWidth: number, textureHeight: number, _heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4d, debugFrustum?: Frustum, zValue?: number } {
    const textureZ = texturePlane.getNormalRef();
    const viewingSpace = sceneContext.viewingSpace;
    const viewX = viewingSpace.rotation.rowX();
    const viewZ = viewingSpace.rotation.rowZ();
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
    const viewFrustum = viewingSpace.getFrustum().transformBy(textureTransform);
    const viewPlanes = new FrustumPlanes(viewFrustum);
    const viewClipPlanes = ConvexClipPlaneSet.createPlanes(viewPlanes.planes!);

    let textureRange = Range3d.createNull();
    const tileToTexture = textureTransform.multiplyTransformTransform(target.location);
    for (const tile of target.tiles) {
      textureRange.extendRange(tileToTexture.multiplyRange(tile.range, scratchRange));
    }

    if (textureRange.isNull)
      return {};

    textureRange = ClipUtilities.rangeOfClipperIntersectionWithRange(viewClipPlanes, textureRange);

    const drapeRange = Range3d.createNull();
    for (const drapeRef of drapeRefs) {
      const drapeTree = drapeRef.treeOwner.tileTree;

      if (!drapeTree)
        return {};
      if (drapeTree.isContentUnbounded) {
        let heightRange = viewingSpace.getTerrainHeightRange();
        if (!heightRange) heightRange = ApproximateTerrainHeights.instance.globalHeightRange;

        textureRange.low.x = Math.min(textureRange.low.x, heightRange.low);
        textureRange.high.x = Math.max(textureRange.high.x, heightRange.high);
      } else {
        const contentRange = textureTransform.multiplyRange(drapeRef.computeWorldContentRange());
        if (!contentRange.isNull)
          drapeRange.extendRange(contentRange);
      }
    }
    if (!drapeRange.isNull) {
      // Union of height
      textureRange.low.x = Math.min(textureRange.low.x, drapeRange.low.x);
      textureRange.high.x = Math.max(textureRange.high.x, drapeRange.high.x);

      // Intersection of texture extents.
      textureRange.low.y = Math.max(textureRange.low.y, drapeRange.low.y);
      textureRange.high.y = Math.min(textureRange.high.y, drapeRange.high.y);
      textureRange.low.z = Math.max(textureRange.low.z, drapeRange.low.z);
      textureRange.high.z = Math.min(textureRange.high.z, drapeRange.high.z);
    }

    const epsilon = .01;
    textureRange.low.x -= epsilon;
    textureRange.high.x += epsilon;

    const textureFrustum = Frustum.fromRange(textureRange);
    const debugFrustum = textureFrustum.clone();
    textureTransform.multiplyInversePoint3dArray(debugFrustum.points, debugFrustum.points);

    if (viewState.isCameraOn) {
      const eyeHeight = (textureRange.low.x + textureRange.high.x) / 2.0;
      const eyePlane = Plane3dByOriginAndUnitNormal.create(Point3d.createScale(textureZ, eyeHeight), textureZ);    // Centered in range - parallel to texture.
      const projectionRay = Ray3d.create(viewState.getEyePoint(), viewZ.crossProduct(textureX).normalize()!);
      let projectionDistance = projectionRay.intersectionWithPlane(eyePlane!);
      const minNearToFarRatio = .01;  // Smaller value allows texture projection to conform tightly to view frustum.
      if (undefined !== projectionDistance) {
        projectionDistance = Math.max(.1, projectionDistance);
        const eyePoint = textureTransform.multiplyPoint3d(projectionRay.fractionToPoint(projectionDistance));
        let near = eyePoint.z - textureRange.high.z;
        let far = eyePoint.z - textureRange.low.z;

        if (near / far < minNearToFarRatio) {
          // If the near-far ratio is less than minimum move the camera back.
          far = (textureRange.high.z - textureRange.low.z) / (1.0 - minNearToFarRatio);
          near = far * minNearToFarRatio;
          eyePoint.z = near + textureRange.high.z;
        }
        const farRange = Range2d.createNull();
        const nearRange = Range2d.createNull();
        // Create a frustum that includes the entire view frustum and all Z values.
        nearRange.low.x = textureRange.low.x;
        nearRange.high.x = textureRange.high.x;
        farRange.low.x = eyePoint.x + far / near * (textureRange.low.x - eyePoint.x);
        farRange.high.x = eyePoint.x + far / near * (textureRange.high.x - eyePoint.x);
        ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(viewClipPlanes, textureRange, (points: GrowableXYZArray) => {
          points.getPoint3dArray().forEach((rangePoint) => {
            const farScale = far / (eyePoint.z - rangePoint.z);
            const nearScale = near / (eyePoint.z - rangePoint.z);
            const nearY = eyePoint.y + nearScale * (rangePoint.y - eyePoint.y);
            const farY = eyePoint.y + farScale * (rangePoint.y - eyePoint.y);
            nearRange.low.y = Math.min(nearRange.low.y, nearY);
            nearRange.high.y = Math.max(nearRange.high.y, nearY);
            farRange.low.y = Math.min(farRange.low.y, farY);
            farRange.high.y = Math.max(farRange.high.y, farY);
          });
        });
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

    const viewFlags = target.currentViewFlags.copy({
      renderMode: RenderMode.SmoothShade,
      transparency: false,
      textures: false,
      lighting: false,
      shadows: false,
      monochrome: false,
      materials: false,
      ambientOcclusion: false,
      visibleEdges: false,
      hiddenEdges: false,
    });

    return { state, viewFlags };
  }
}
