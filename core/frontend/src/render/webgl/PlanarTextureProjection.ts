/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Rendering
 */

import { Frustum, FrustumPlanes, Npc, RenderMode } from "@itwin/core-common";
import {
  ClipUtilities, ConvexClipPlaneSet, GrowableXYZArray, Map4d, Matrix3d, Matrix4d, Plane3dByOriginAndUnitNormal, Point3d, Range1d, Range2d, Range3d,
  Ray3d, Transform,
} from "@itwin/core-geometry";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { Tile, TileTreeReference } from "../../tile/internal";
import { SceneContext } from "../../ViewContext";
import { ViewState3d } from "../../ViewState";
import { RenderState } from "./RenderState";
import { Target } from "./Target";

const scratchRange = Range3d.createNull();
const scratchMap4d = Map4d.createIdentity();
const scratchMatrix4d = Matrix4d.createIdentity();
export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 2 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private static isTileRangeInBounds(tileRange: Range3d, drapeRange: Range3d): boolean {
    // return false if tile is outside of drapeRange, ignoring height (x) for this
    if (tileRange.low.y > drapeRange.high.y || tileRange.high.y < drapeRange.low.y)
      return false;
    if (tileRange.low.z > drapeRange.high.z || tileRange.high.z < drapeRange.low.z)
      return false;
    return true;
  }

  public static computePlanarTextureProjection(
    texturePlane: Plane3dByOriginAndUnitNormal,
    sceneContext: SceneContext,
    target: { tiles: Tile[], location: Transform },
    drapeRefs: TileTreeReference[],
    viewState: ViewState3d,
    textureWidth: number,
    textureHeight: number,
    maskRange: Range3d,
    _heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4d, debugFrustum?: Frustum } {
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
    const viewPlanes = FrustumPlanes.fromFrustum(viewFrustum);
    const viewClipPlanes = ConvexClipPlaneSet.createPlanes(viewPlanes.planes);

    const contentUnBoundedRange = Range1d.createNull();

    // calculate drapeRange from drapeRefs (mask references or drape reference).
    const drapeRange = Range3d.createNull();
    for (const drapeRef of drapeRefs) {
      const drapeTree = drapeRef.treeOwner.tileTree;
      if (!drapeTree)
        return {};
      if (drapeTree.isContentUnbounded) {
        let heightRange = viewingSpace.getTerrainHeightRange();
        if (!heightRange)
          heightRange = ApproximateTerrainHeights.instance.globalHeightRange;
        contentUnBoundedRange.low = Math.min(contentUnBoundedRange.low, heightRange.low);
        contentUnBoundedRange.high = Math.max(contentUnBoundedRange.high, heightRange.high);
      } else if (maskRange.isNull) {
        const r = Range3d.createNull();
        drapeRef.unionFitRange(r);
        const contentRange = textureTransform.multiplyRange(r);
        if (!contentRange.isNull)
          drapeRange.extendRange(contentRange);
      } else {
        const contentRange = textureTransform.multiplyRange(maskRange);
        drapeRange.extendRange(contentRange);
      }
    }

    // get range of only the tiles to be masked or draped onto.
    let textureRange = Range3d.createNull();
    const tileToTexture = textureTransform.multiplyTransformTransform(target.location);
    for (const tile of target.tiles) {
      tileToTexture.multiplyRange(tile.range, scratchRange);
      // Skip tile if it is outside of drapeRange because we don't want the extra heights from distant tiles included.
      if (drapeRange.isNull || PlanarTextureProjection.isTileRangeInBounds(scratchRange, drapeRange))
        textureRange.extendRange(scratchRange);
    }

    if (textureRange.isNull)
      return {};

    textureRange = ClipUtilities.rangeOfClipperIntersectionWithRange(viewClipPlanes, textureRange);

    if (!contentUnBoundedRange.isNull) {
      // Union of height
      textureRange.low.x = Math.min(textureRange.low.x, contentUnBoundedRange.low);
      textureRange.high.x = Math.max(textureRange.high.x, contentUnBoundedRange.high);
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
    let debugFrustum;
    if (true)  // debugFrustum as textureRange.
      debugFrustum = textureFrustum.clone();
    else  // debugFrustum as drapeRange.
      debugFrustum = Frustum.fromRange(drapeRange);

    textureTransform.multiplyInversePoint3dArray(debugFrustum.points, debugFrustum.points);

    const viewZVecZ = viewState.getRotation().rowZ().z;

    // This code attempts to use a projection frustum that aligns to the camera frustum in order to get higher mask resolution closer to the eye.
    // Limit its use to views that have an eyepoint above the bottom of the frustum and are looking down at a view angle > 5 degrees, otherwise it causes issues.
    // viewZVecZ is negative when looking up, positive when looking down.
    if (viewState.isCameraOn && viewState.getEyePoint().z > textureRange.low.x && viewZVecZ > 0.09) {
      // NB moved the eyePlane from the center to the bottom of the textureRange to solve problems when the eye was below the eyePlane.
      const eyePlane = Plane3dByOriginAndUnitNormal.create(Point3d.createScale(textureZ, textureRange.low.x), textureZ);  // at bottom of range - parallel to texture.
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
        // Set NPC from results.
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
    const npcToView = Map4d.createBoxMap(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), Point3d.create(0, 0, 0), Point3d.create(textureWidth, textureHeight, 1), scratchMap4d)!;
    const npcToWorld = worldToNpc.createInverse(scratchMatrix4d);
    if (undefined === npcToWorld) {
      return {};
    }
    const worldToNpcMap = Map4d.createRefs(worldToNpc, npcToWorld);
    const worldToViewMap = npcToView.multiplyMapMap(worldToNpcMap);

    return { textureFrustum, worldToViewMap, projectionMatrix: worldToNpc, debugFrustum };
  }

  public static getTextureDrawingParams(target: Target) {
    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    const viewFlags = target.currentViewFlags.copy({
      renderMode: RenderMode.SmoothShade,
      wiremesh: false,
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
