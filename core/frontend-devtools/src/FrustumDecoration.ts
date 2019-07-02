/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Point3d,
} from "@bentley/geometry-core";
import {
  ColorDef,
  Frustum,
  LinePixels,
  Npc,
} from "@bentley/imodeljs-common";
import {
  CoordSystem,
  DecorateContext,
  Decorator,
  GraphicBuilder,
  GraphicType,
  IModelApp,
  Viewport,
  ViewState3d,
} from "@bentley/imodeljs-frontend";

/**
 * Decorates the viewport with a graphical depiction of a Frustum.
 * This is obviously only useful when drawn inside a viewport using a *different* Frustum.
 * Options for doing so include:
 *  - Having more than one viewport, and drawing the frustum of one viewport inside the other viewports; and
 *  - Allowing the user to take a snapshot of the current frustum, then navigate the view to inspect it within the same viewport.
 */
class FrustumDecoration {
  private readonly _worldFrustum: Frustum;
  private readonly _adjustedWorldFrustum: Frustum;
  // private readonly _npcFrustum: Frustum;
  // private readonly _eyePoint: Point3d;
  // private readonly _focalPlane: number;
  // private readonly _isCameraOn: boolean;

  private constructor(vp: Viewport, _view: ViewState3d) {
    this._worldFrustum = vp.getFrustum(CoordSystem.World, false);
    this._adjustedWorldFrustum = vp.getFrustum(CoordSystem.World, true);

    /* ###TODO: need original ViewFrustum's npc-to-world transform...
    this._npcFrustum = vp.getFrustum(CoordSystem.Npc, true);
    this._eyePoint = view.camera.getEyePoint().clone();
    this._isCameraOn = vp.isCameraOn;

    let npcZ = vp.worldToNpc(view.getTargetPoint()).z;
    if (npcZ < 0.0 || npcZ > 1.0) {
      const near = new Point3d(0.5, 0.5, 0.0);
      const far = new Point3d(0.5, 0.5, 1.0);
      const target = near.interpolate(0.5, far);
      npcZ = target.z;
    }

    this._focalPlane = npcZ;
    */
  }

  public static create(vp: Viewport): FrustumDecoration | undefined {
    const view = vp.view.isSpatialView() ? vp.view : undefined;
    return undefined !== view ? new FrustumDecoration(vp, view) : undefined;
  }

  public decorate(context: DecorateContext): void {
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);

    // this.drawEyePositionAndFocalPlane(builder, context.viewport);
    this.drawFrustumBox(builder, false, context.viewport); // show original frustum...
    this.drawFrustumBox(builder, true, context.viewport); // show adjusted frustum...

    context.addDecorationFromBuilder(builder);
  }

  private drawFrustumBox(builder: GraphicBuilder, adjustedBox: boolean, vp: Viewport): void {
    const frustum = adjustedBox ? this._adjustedWorldFrustum : this._worldFrustum;
    const backPts = this.getPlanePts(frustum.points, false); // back plane
    const frontPts = this.getPlanePts(frustum.points, true); // front plane

    const bgColor = vp.view.backgroundColor;
    const backAndBottomColor = bgColor.adjustForContrast(ColorDef.red);
    const frontAndTopLeftColor = bgColor.adjustForContrast(ColorDef.blue);
    const frontAndTopRightColor = bgColor.adjustForContrast(ColorDef.green);
    const edgeWeight = adjustedBox ? 2 : 1;
    const edgeStyle = adjustedBox ? LinePixels.Solid : LinePixels.Code2;

    // Back plane
    builder.setSymbology(backAndBottomColor, ColorDef.black, edgeWeight, edgeStyle);
    builder.addLineString(backPts);

    // Front plane
    builder.setSymbology(frontAndTopLeftColor, ColorDef.black, edgeWeight, edgeStyle);
    builder.addLineString(frontPts);

    // Bottom edge
    builder.setSymbology(backAndBottomColor, ColorDef.black, edgeWeight, edgeStyle);
    builder.addLineString(this.getEdgePts(backPts, frontPts, 0));
    builder.addLineString(this.getEdgePts(backPts, frontPts, 1));

    // Top edge
    builder.setSymbology(frontAndTopRightColor, ColorDef.black, edgeWeight, edgeStyle);
    builder.addLineString(this.getEdgePts(backPts, frontPts, 2));
    builder.setSymbology(frontAndTopLeftColor, ColorDef.black, edgeWeight, edgeStyle);
    builder.addLineString(this.getEdgePts(backPts, frontPts, 3));
  }

  private getEdgePts(startPts: Point3d[], endPts: Point3d[], index: number): Point3d[] {
    return [
      startPts[index],
      endPts[index],
    ];
  }

  private getPlanePts(frustPts: Point3d[], front: boolean): Point3d[] {
    const baseIndex = front ? Npc._001 : Npc._000;
    const planePts = [
      frustPts[baseIndex + Npc._000],
      frustPts[baseIndex + Npc._100],
      frustPts[baseIndex + Npc._110],
      frustPts[baseIndex + Npc._010],
    ];

    planePts.push(planePts[0]);
    return planePts;
  }

  /*
  private drawEyePositionAndFocalPlane(builder: GraphicBuilder, vp: Viewport): void {
    if (!this._isCameraOn)
      return;

    // Eye position...
    const contrastColor = vp.getContrastToBackgroundColor();
    builder.setSymbology(contrastColor, ColorDef.black, 8);
    builder.addPointString(1, this._eyePoint);

    // Focal plane...
    const focalPts = this.getFocalPlanePts();
    const focalPlaneColor = vp.view.backgroundColor.adjustForContrast(ColorDef.green);
    const focalTransColor = focalPlaneColor.clone();
    focalTransColor.setTransparency(100);
    builder.setSymbology(focalPlaneColor, focalTransColor, 2);
    builder.addLineString(focalPts);
    builder.addShape(focalPts);
  }

  private getFocalPlanePts(): Point3d[5] {
    const frustum = this._npcFrustum;
    const pts = this.getPlanePts(frustum.points, false);
    for (let pt of pts)
      pt.z = this._focalPlane;

    // ###TODO: Need original viewport's NpcToWorld...
  }
  */
}

/** @alpha */
export class FrustumDecorator implements Decorator {
  private readonly _decoration?: FrustumDecoration;

  private constructor(vp: Viewport) {
    this._decoration = FrustumDecoration.create(vp);
  }

  public decorate(context: DecorateContext): void {
    if (undefined !== this._decoration)
      this._decoration.decorate(context);
  }

  private static _instance?: FrustumDecorator;

  public static enable(vp: Viewport): void {
    FrustumDecorator.disable();
    FrustumDecorator._instance = new FrustumDecorator(vp);
    IModelApp.viewManager.addDecorator(FrustumDecorator._instance);
  }

  public static disable(): void {
    const instance = FrustumDecorator._instance;
    if (undefined !== instance) {
      IModelApp.viewManager.dropDecorator(instance);
      FrustumDecorator._instance = undefined;
    }
  }
}
