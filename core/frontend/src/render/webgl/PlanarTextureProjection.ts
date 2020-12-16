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
import { assert } from "console";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { SceneContext } from "../../imodeljs-frontend";
import { TileTreeReference } from "../../tile/internal";
import { ViewingSpace } from "../../ViewingSpace";
import { ViewState3d } from "../../ViewState";
import { TextureUnit } from "./RenderFlags";
import { RenderState } from "./RenderState";
import { Target } from "./Target";

const scratchPoint = Point3d.createZero();
const scratchRange = Range3d.createNull();
export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, sceneContext: SceneContext, targetRef: TileTreeReference, drapeRefs: TileTreeReference[], viewState: ViewState3d, textureWidth: number, textureHeight: number, _heightRange?: Range1d): { textureFrustum?: Frustum, worldToViewMap?: Map4d, projectionMatrix?: Matrix4d, debugFrustum?: Frustum, zValue?: number } {
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

    const targetTree = targetRef.treeOwner.tileTree
    const args = targetRef.createDrawArgs(sceneContext);;
    if (!targetTree || !args)
      return {};

    const selectedTargetTiles = targetTree.selectTiles(args);

    let textureRange = Range3d.createNull();
    const tileToTexture = textureTransform.multiplyTransformTransform(args.location)
    for (const tile of selectedTargetTiles)
      textureRange.extendRange(tileToTexture.multiplyRange(tile.range, scratchRange));

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
      const projectionDistance = projectionRay.intersectionWithPlane(eyePlane!);
      const minNearToFarRatio = .01;  // Smaller value allows texture projection to conform tightly to view frustum.
      if (undefined !== projectionDistance) {
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
        nearRange.high.x = textureRange.high.x
        farRange.low.x = eyePoint.x + far / near * (textureRange.low.x - eyePoint.x);
        farRange.high.x = eyePoint.x + far / near * (textureRange.high.x - eyePoint.x);
        const expandCamera = ((rangePoint: Point3d): void => {
          const farScale = far / (eyePoint.z - rangePoint.z);
          const nearScale = near / (eyePoint.z - rangePoint.z);
          const nearY = eyePoint.y + nearScale * (rangePoint.y - eyePoint.y);
          const farY = eyePoint.y + farScale * (rangePoint.y - eyePoint.y);
          nearRange.low.y = Math.min(nearRange.low.y, nearY);
          nearRange.high.y = Math.max(nearRange.high.y, nearY);
          farRange.low.y = Math.min(farRange.low.y, farY);
          farRange.high.y = Math.max(farRange.high.y, farY);
        });
        textureRange.corners().forEach((point) => expandCamera(point));
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
