/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Constant, Range3d, Transform } from "@bentley/geometry-core";
import {
  AxisAlignedBox3d,
  Frustum,
  HiddenLine,
  SectionDrawingProps,
  ViewDefinition2dProps,
  ViewFlagOverrides,
  ViewStateProps,
} from "@bentley/imodeljs-common";
import { ExtentLimits, ViewState2d, ViewState3d } from "./ViewState";
import { IModelConnection } from "./IModelConnection";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle2dState } from "./DisplayStyleState";
import { IModelApp } from "./IModelApp";
import { ViewRect } from "./ViewRect";
import { OffScreenViewport } from "./Viewport";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { Scene} from "./render/Scene";
import { MockRender } from "./render/MockRender";

/** Draws the contents of a [SectionDrawing]($backend)'s spatial view directly into a [[DrawingViewState]], if the SectionDrawing specifies it should be. */
class SectionDrawingAttachment {
  private readonly _viewport: OffScreenViewport;
  private readonly _viewFlagOverrides: ViewFlagOverrides;
  private readonly _toDrawing: Transform;
  private readonly _fromDrawing: Transform;
  private readonly _originalFrustum = new Frustum();
  private readonly _hiddenLineSettings?: HiddenLine.Settings;
  private readonly _originalView: ViewState3d;
  private readonly _viewRect = new ViewRect(0, 0, 1, 1);
  private readonly _scale: { x: number, y: number };
  public scene?: Scene;
  public symbologyOverrides:  FeatureSymbology.Overrides;

  public constructor(attachedView: ViewState3d, drawingToSpatial: Transform, drawingView: DrawingViewState) {
    // Save the input view for clone(). Attach a modifiable copy of it to the viewport.
    this._originalView = attachedView;
    attachedView = attachedView.clone();

    this.symbologyOverrides = new FeatureSymbology.Overrides(attachedView);

    this._viewFlagOverrides = new ViewFlagOverrides(attachedView.viewFlags);
    this._viewFlagOverrides.setShowClipVolume(true);
    this._viewFlagOverrides.setApplyLighting(false);
    this._viewFlagOverrides.setShowShadows(false);

    this._viewport = OffScreenViewport.create(attachedView, this._viewRect, true, new SectionDrawingTarget(this));

    // Compute transform from attached view's world coordinates to drawing's world coordinates.
    // NB: We obtain the extents and origin from the *viewport* not the *view* - the viewport may have adjusted them.
    // NB: An assumption exists that the transform involves only rotation and translation - no scaling.
    const extents = this._viewport.viewingSpace.viewDelta.clone();
    const skew = attachedView.getAspectRatioSkew();
    const scaleY = 0 !== skew ? (1 / skew) : 1;
    this._scale = { x: 1, y: scaleY };
    const zDepth = 1.01 * Math.abs(extents.z); // Give a little padding so geometry right up against far plane doesn't get clipped.

    // View origin is at the *back* of the view. Align *front* of view.
    const viewRot = attachedView.getRotation();
    const viewOrg = viewRot.multiplyVector(this._viewport.viewingSpace.viewOrigin);
    viewOrg.z += zDepth;
    viewRot.multiplyTranposeVectorInPlace(viewOrg);

    const matrix = Matrix3d.createScale(1, scaleY, 1);
}

/** Lightweight do-almost-nothing RenderTarget used by SectionDrawingAttachment.
 * No WebGL resources are allocated - the actual graphics are drawn into the "real" RenderTarget.
 */
class SectionDrawingTarget extends MockRender.OffScreenTarget {
  private readonly _attachment: SectionDrawingAttachment;
  public constructor(attachment: SectionDrawingAttachment) {
    // The dimensions don't matter.
    const rect = new ViewRect(1, 1);
    super(IModelApp.renderSystem, rect);
    this._attachment = attachment;
  }

  public changeScene(scene: Scene): void {
    this._attachment.scene = scene;
  }

  public overrideFeatureSymbology(ovrs: FeatureSymbology.Overrides): void {
    this._attachment.symbologyOverrides = ovrs;
  }
}

/** A view of a [DrawingModel]($backend)
 * @public
 */
export class DrawingViewState extends ViewState2d {
  /** @internal */
  public static get className() { return "DrawingViewDefinition"; }
  private readonly _modelLimits: ExtentLimits;
  private readonly _viewedExtents: AxisAlignedBox3d;

  public constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState, extents: AxisAlignedBox3d) {
    super(props, iModel, categories, displayStyle);
    if (categories instanceof DrawingViewState) {
      this._viewedExtents = categories._viewedExtents.clone();
      this._modelLimits = { ...categories._modelLimits };
    } else {
      this._viewedExtents = extents;
      this._modelLimits = { min: Constant.oneMillimeter, max: 10 * extents.maxLength() };
    }
  }

  public static createFromProps(props: ViewStateProps, iModel: IModelConnection): DrawingViewState {
    const cat = new CategorySelectorState(props.categorySelectorProps, iModel);
    const displayStyleState = new DisplayStyle2dState(props.displayStyleProps, iModel);
    const extents = props.modelExtents ? Range3d.fromJSON(props.modelExtents) : new Range3d();

    // use "new this" so subclasses are correct
    return new this(props.viewDefinitionProps as ViewDefinition2dProps, iModel, cat, displayStyleState, extents);
  }

  public getViewedExtents(): AxisAlignedBox3d {
    return this._viewedExtents;
  }

  public get defaultExtentLimits() {
    return this._modelLimits;
  }

  /** @internal */
  public isDrawingView(): this is DrawingViewState { return true; }
}
