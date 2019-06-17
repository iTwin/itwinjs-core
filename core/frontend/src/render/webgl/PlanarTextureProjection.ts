/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */
import { assert } from "@bentley/bentleyjs-core";
import { Target } from "./Target";
import { Matrix4 } from "./Matrix";
import { TileTreeModelState } from "../../ModelState";
import { Frustum, Npc, FrustumPlanes, RenderMode } from "@bentley/imodeljs-common";
import { Plane3dByOriginAndUnitNormal, Point3d, Range3d, Transform, Matrix3d, Matrix4d, Ray3d } from "@bentley/geometry-core";
import { RenderState } from "./RenderState";
import { ViewState3d } from "../../ViewState";
import { ViewFrustum } from "../../Viewport";

export class PlanarTextureProjection {
  private static _postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);
  private static _scratchFrustum = new Frustum();

  public static computePlanarTextureProjection(texturePlane: Plane3dByOriginAndUnitNormal, viewFrustum: ViewFrustum, texturedModel: TileTreeModelState, viewState: ViewState3d): { textureFrustum?: Frustum, projectionMatrix?: Matrix4 } {
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

    let npcRange = Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1);
    const viewFrustumFrustum = viewFrustum.getFrustum();
    const viewMap = viewFrustumFrustum.toMap4d()!;
    const viewPlanes = new FrustumPlanes(viewFrustumFrustum);
    if (texturedModel && texturedModel.tileTree) {
      const tileRange = Range3d.createNull();
      texturedModel.tileTree.accumlateTransformedRange(tileRange, viewMap.transform0, viewPlanes);
      if (undefined === tileRange)
        return {};
      npcRange = npcRange.intersect(tileRange);
    }
    PlanarTextureProjection._scratchFrustum.initFromRange(npcRange);
    viewMap.transform1.multiplyPoint3dArrayQuietNormalize(PlanarTextureProjection._scratchFrustum.points);
    const range = Range3d.createTransformedArray(textureTransform, PlanarTextureProjection._scratchFrustum.points);
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
        const minFraction = 1.0 / 50.0;
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
      assert(false);
      return {};
    }
    const projectionMatrix = new Matrix4();
    projectionMatrix.initFromMatrix4d(PlanarTextureProjection._postProjectionMatrixNpc.multiplyMatrixMatrix(frustumMap.transform0));

    return { textureFrustum, projectionMatrix };
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
    viewFlags.sourceLights = false;
    viewFlags.cameraLights = false;
    viewFlags.solarLight = false;
    viewFlags.shadows = false;
    viewFlags.noGeometryMap = true;
    viewFlags.monochrome = false;
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    return { state, viewFlags };
  }
}
