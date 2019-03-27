/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { Range3d, ClipVector, ClipMask, ClipShape, ClipPrimitive, ClipPlane, ConvexClipPlaneSet, Plane3dByOriginAndUnitNormal, Vector3d, Point3d } from "@bentley/geometry-core";
import { Placement2d, Placement3d, Placement2dProps } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { BeButtonEvent, EventHandled } from "./Tool";
import { LocateResponse } from "../ElementLocateManager";
import { Id64Arg } from "@bentley/bentleyjs-core";
import { ViewTool } from "./ViewTool";
import { ScreenViewport } from "../Viewport";

/** @internal The method to define the view clip volume */
export const enum ClipMethod {
  Plane,
  Box,
  Element,
}

/** @internal The orientation to use to define the view clip volume */
export const enum ClipOrientation {
  Top,
  Front,
  Left,
  Bottom,
  Back,
  Right,
  Face,
  View,
}

/** @internal A tool to define a clip volume for a view */
export class ClipViewTool extends ViewTool {
  public static toolId = "View.Clip";
  protected _method = ClipMethod.Plane;
  protected _orientation = ClipOrientation.Top;
  public alwaysUseRange: boolean;

  constructor(viewport: ScreenViewport, alwaysUseRange: boolean = false) {
    super(viewport);
    this.alwaysUseRange = alwaysUseRange;
  }

  public onInstall(): boolean { return (undefined !== this.viewport && this.viewport.view.allow3dManipulations()); }

  public onPostInstall(): void {
    super.onPostInstall();
    if (ClipMethod.Element === this._method) {
      if (undefined !== this.viewport && this.viewport.iModel.selectionSet.isActive) {
        this.doClipToElements(this.viewport, this.viewport.iModel.selectionSet.elements, this.alwaysUseRange); // tslint:disable-line:no-floating-promises
        return;
      }
      IModelApp.accuSnap.enableLocate(true);
      return;
    }
    IModelApp.accuSnap.enableSnap(true);
  }

  /*
    public transformInPlace(transform: Transform): boolean {
      if (transform.isIdentity)
        return true;

      super.transformInPlace(transform);

      if (this._transformValid)
        transform.multiplyTransformTransform(this._transformFromClip!, this._transformFromClip);
      else
        this._transformFromClip = transform;

      this._transformToClip = this._transformFromClip!.inverse(); // could be undefined
      this._transformValid = true;
      return true;
    }

      this.transform.multiplyRange(Range3d.createRange2d(this.bbox, 0), range);
      this.transform.multiplyRange(this.bbox, range);
  */

  public async doClipToElements(viewport: ScreenViewport, ids: Id64Arg, _alwaysUseRange: boolean = false): Promise<boolean> {
    const elementProps = await viewport.iModel.elements.getProps(ids); // TODO: For single element check if solid primitve we can create a clip shape from...
    if (0 === elementProps.length)
      return false;
    const range = new Range3d();
    for (const props of elementProps) {
      if (undefined === props.placement)
        continue;
      const hasAngle = (arg: any): arg is Placement2dProps => arg.angle !== undefined;
      const placement = hasAngle(props.placement) ? Placement2d.fromJSON(props.placement) : Placement3d.fromJSON(props.placement);
      range.extendRange(placement.calculateRange());
    }
    if (range.isNull)
      return false;
    const clip = ClipVector.createEmpty();
    const block = ClipShape.createBlock(range, range.isAlmostZeroZ ? ClipMask.XAndY : ClipMask.All);
    clip.appendReference(block);

    viewport.view.setViewClip(clip);
    viewport.synchWithView(true);
    this.exitTool();
    return true;
  }

  public doClipToPlane(viewport: ScreenViewport, origin: Point3d, normal: Vector3d): boolean {
    const plane = Plane3dByOriginAndUnitNormal.create(origin, normal);
    if (undefined === plane)
      return false;
    const clipPlane = ClipPlane.createPlane(plane);
    const planeSet = ConvexClipPlaneSet.createPlanes([clipPlane]);
    const primitive = ClipPrimitive.createCapture(planeSet);
    const clip = ClipVector.createEmpty();
    clip.appendReference(primitive);
    viewport.view.setViewClip(clip);
    viewport.synchWithView(true);
    this.exitTool();
    return true;
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this.viewport)
      return EventHandled.No;

    if (ClipMethod.Element === this._method) {
      const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
      if (undefined === hit || !hit.isElementHit)
        return EventHandled.No;
      return await this.doClipToElements(this.viewport, hit.sourceId, this.alwaysUseRange) ? EventHandled.Yes : EventHandled.No;
    }

    return this.doClipToPlane(this.viewport, ev.point, Vector3d.unitZ(-1)) ? EventHandled.Yes : EventHandled.No;
  }
}
