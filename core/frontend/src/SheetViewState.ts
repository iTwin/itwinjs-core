/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, CompressedId64Set, dispose, expectDefined, Id64Array, Id64String } from "@itwin/core-bentley";
import { Angle, ClipShape, ClipVector, Constant, Matrix3d, Point2d, Point3d, PolyfaceBuilder, Range2d, Range3d, StrokeOptions, Transform } from "@itwin/core-geometry";
import {
  AxisAlignedBox3d, ColorDef, Feature, FeatureTable, Frustum, Gradient, GraphicParams, HiddenLine, HydrateViewStateRequestProps, HydrateViewStateResponseProps, PackedFeatureTable, Placement2d, SheetProps,
  TextureTransparency, ViewAttachmentProps, ViewDefinition2dProps, ViewFlagOverrides, ViewStateProps,
} from "@itwin/core-common";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle2dState } from "./DisplayStyleState";
import { IModelConnection } from "./IModelConnection";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { RenderGraphic } from "./render/RenderGraphic";
import { GraphicBranch } from "./render/GraphicBranch";
import { Frustum2d } from "./Frustum2d";
import { Scene } from "./render/Scene";
import { Decorations } from "./render/Decorations";
import { MockRender } from "./internal/render/MockRender";
import { RenderClipVolume } from "./render/RenderClipVolume";
import { RenderMemory } from "./render/RenderMemory";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { DecorateContext, SceneContext } from "./ViewContext";
import { IModelApp } from "./IModelApp";
import { CoordSystem } from "./CoordSystem";
import { OffScreenViewport, Viewport } from "./Viewport";
import { AttachToViewportArgs, ComputeDisplayTransformArgs, GetAttachmentViewportArgs, ViewState, ViewState2d } from "./ViewState";
import { DrawingViewState } from "./DrawingViewState";
import { createDefaultViewFlagOverrides, DisclosedTileTreeSet, TileGraphicType } from "./tile/internal";
import { imageBufferToPngDataUrl, openImageDataUrlInNewWindow } from "./common/ImageUtil";
import { ViewRect } from "./common/ViewRect";
import { GraphicType } from "./common/render/GraphicType";
import { SheetViewAttachments } from "./internal/SheetViewAttachments";

// cSpell:ignore ovrs

/** Describes the geometry and styling of a sheet border decoration.
 * The sheet border decoration mimics a sheet of paper with a drop shadow.
 */
class SheetBorder {
  private _rect: Point2d[];
  private _shadow: Point2d[];
  private _gradient: Gradient.Symb;

  private constructor(rect: Point2d[], shadow: Point2d[], gradient: Gradient.Symb) {
    this._rect = rect;
    this._shadow = shadow;
    this._gradient = gradient;
  }

  /** Create a new sheet border. If a context is supplied, points are transformed to view coordinates. */
  public static create(width: number, height: number, context?: DecorateContext) {
    // Rect
    const rect: Point3d[] = [
      Point3d.create(0, height),
      Point3d.create(0, 0),
      Point3d.create(width, 0),
      Point3d.create(width, height),
      Point3d.create(0, height)];
    if (context) {
      context.viewport.worldToViewArray(rect);
    }

    // Shadow
    const shadowWidth = .01 * Math.sqrt(width * width + height * height);
    const shadow: Point3d[] = [
      Point3d.create(shadowWidth, 0),
      Point3d.create(shadowWidth, -shadowWidth),
      Point3d.create(width + shadowWidth, -shadowWidth),
      Point3d.create(width + shadowWidth, height - shadowWidth),
      Point3d.create(width, height - shadowWidth),
      Point3d.create(width, 0),
      Point3d.create(shadowWidth, 0),
    ];
    if (context) {
      context.viewport.worldToViewArray(shadow);
    }

    // Gradient
    const gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Linear;
    gradient.angle = Angle.createDegrees(-45);
    gradient.keys = [{ value: 0, color: ColorDef.from(25, 25, 25) }, { value: 0.5, color: ColorDef.from(150, 150, 150) }];

    // Copy over points
    const rect2d: Point2d[] = [];
    for (const point of rect)
      rect2d.push(Point2d.createFrom(point));
    const shadow2d: Point2d[] = [];
    for (const point of shadow)
      shadow2d.push(Point2d.createFrom(point));

    return new SheetBorder(rect2d, shadow2d, gradient);
  }

  public getRange(): Range2d {
    const range = Range2d.createArray(this._rect);
    const shadowRange = Range2d.createArray(this._shadow);
    range.extendRange(shadowRange);
    return range;
  }

  /** Add this border to the given GraphicBuilder. */
  public addToBuilder(builder: GraphicBuilder) {
    const lineColor = ColorDef.black;
    const fillColor = ColorDef.black;

    const params = new GraphicParams();
    params.fillColor = fillColor;
    params.gradient = this._gradient;

    builder.activateGraphicParams(params);
    builder.addShape2d(this._shadow, Frustum2d.minimumZDistance);

    builder.setSymbology(lineColor, fillColor, 2);
    builder.addLineString2d(this._rect, 0);
  }
}

/** A view of a [SheetModel]($backend).
 * @public
 * @extensions
 */
export class SheetViewState extends ViewState2d {
  /** The width and height of the sheet in world coordinates. */
  public readonly sheetSize: Point2d;
  private _viewAttachments: SheetViewAttachments;
  private readonly _viewedExtents: AxisAlignedBox3d;
  private _onViewAttachmentsReloaded: () => void = () => undefined;

  public get attachmentIds(): readonly string[] {
    return this._viewAttachments.attachmentIds;
  }

  public static override get className() { return "SheetViewDefinition"; }

  public static override createFromProps(viewStateData: ViewStateProps, iModel: IModelConnection): SheetViewState {
    const cat = new CategorySelectorState(viewStateData.categorySelectorProps, iModel);
    const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, iModel);

    // use "new this" so subclasses are correct
    return new this(viewStateData.viewDefinitionProps as ViewDefinition2dProps, iModel, cat, displayStyleState, expectDefined(viewStateData.sheetProps), expectDefined(viewStateData.sheetAttachments));
  }

  public override toProps(): ViewStateProps {
    const props = super.toProps();

    props.sheetAttachments = [...this.attachmentIds];

    // For sheetProps all that is actually used is the size, so just null out everything else.
    const codeProps = { spec: "", scope: "", value: "" };
    props.sheetProps = {
      model: "",
      code: codeProps,
      classFullName: "",
      width: this.sheetSize.x,
      height: this.sheetSize.y,
      scale: 1,
    };

    return props;
  }

  /** Strictly for testing. @internal */
  public get viewAttachmentProps(): Array<Readonly<ViewAttachmentProps>> {
    return this._viewAttachments.attachmentProps;
  }

  /** Strictly for testing. @internal */
  public get viewAttachmentInfos(): readonly Id64String[] | Array<{ attachedView: ViewState }> {
    return this._viewAttachments.attachmentInfos;
  }

  /** Strictly for testing. @internal */
  public get attachments(): object[] | undefined {
    return this._viewAttachments.attachments;
  }

  public override isDrawingView(): this is DrawingViewState { return false; }
  public override isSheetView(): this is SheetViewState { return true; }

  public constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState, sheetProps: SheetProps, attachments: Id64Array) {
    super(props, iModel, categories, displayStyle);
    if (categories instanceof SheetViewState) {
      // we are coming from clone...
      this.sheetSize = categories.sheetSize.clone();
      this._viewAttachments = categories._viewAttachments.clone(iModel);
      this._viewedExtents = categories._viewedExtents.clone();
    } else {
      this.sheetSize = Point2d.create(sheetProps.width, sheetProps.height);
      this._viewAttachments = SheetViewAttachments.create(attachments);

      const extents = new Range3d(0, 0, 0, this.sheetSize.x, this.sheetSize.y, 0);
      const margin = 1.1;
      extents.scaleAboutCenterInPlace(margin);
      this._viewedExtents = extents;
    }

    if (iModel.isBriefcaseConnection()) {
      iModel.txns.onElementsChanged.addListener(async (changes) => {
        let reload = false;
        for (const change of changes.filter({ includeMetadata: (meta) => meta.is("BisCore.ViewAttachment")})) {
          if (change.type === "inserted" || this._viewAttachments.attachmentIds.includes(change.id)) {
            reload = true;
            break;
          }
        }

        if (reload) {
          await this._viewAttachments.reload(this.baseModelId, iModel);
          this._onViewAttachmentsReloaded();
        }
      });
    }
  }

  public override getOrigin() {
    const origin = super.getOrigin();
    origin.z = -this._viewAttachments.maxDepth;
    return origin;
  }

  public override getExtents() {
    const extents = super.getExtents();
    extents.z = this._viewAttachments.maxDepth + Frustum2d.minimumZDistance;
    return extents;
  }

  /** Overrides [[ViewState.discloseTileTrees]] to include tile trees associated with [ViewAttachment]($backend)s displayed on this sheet. */
  public override discloseTileTrees(trees: DisclosedTileTreeSet): void {
    super.discloseTileTrees(trees);
    trees.disclose(this._viewAttachments);
  }

  /** @internal */
  public override collectNonTileTreeStatistics(stats: RenderMemory.Statistics): void {
    super.collectNonTileTreeStatistics(stats);
    this._viewAttachments.collectStatistics(stats);
  }

  public override get defaultExtentLimits() {
    return { min: Constant.oneMillimeter, max: this.sheetSize.magnitude() * 10 };
  }

  public override getViewedExtents(): AxisAlignedBox3d {
    return this._viewedExtents;
  }

  /** @internal */
  protected override preload(hydrateRequest: HydrateViewStateRequestProps): void {
    super.preload(hydrateRequest);
    this._viewAttachments.preload(hydrateRequest);
  }

  /** @internal */
  protected override async postload(hydrateResponse: HydrateViewStateResponseProps): Promise<void> {
    const promises = [];
    promises.push(super.postload(hydrateResponse));
    promises.push(this._viewAttachments.postload(hydrateResponse, this.iModel));
    await Promise.all(promises);
  }

  /** @internal */
  public override createScene(context: SceneContext): void {
    super.createScene(context);
    this._viewAttachments.addToScene(context);
  }

  /** @internal */
  public override get secondaryViewports(): Iterable<Viewport> {
    return this._viewAttachments.getSecondaryViewports();
  }

  /** @internal */
  private async queryAttachmentIds(): Promise<Id64Array> {
    const ecsql = `SELECT ECInstanceId as attachmentId FROM bis.ViewAttachment WHERE model.Id=${this.baseModelId}`;
    const ids: string[] = [];
    for await (const row of this.iModel.createQueryReader(ecsql))
      ids.push(row[0]);

    return ids;
  }

  public override async changeViewedModel(modelId: Id64String): Promise<void> {
    await super.changeViewedModel(modelId);

    const attachmentIds = await this.queryAttachmentIds();

    dispose(this._viewAttachments);
    this._viewAttachments = SheetViewAttachments.create(attachmentIds);
  }

  /** See [[ViewState.attachToViewport]]. */
  public override attachToViewport(args: AttachToViewportArgs): void {
    super.attachToViewport(args);
    this._viewAttachments.attachToViewport({
      backgroundColor: this.displayStyle.backgroundColor,
      sheetModelId: this.baseModelId,
    });

    this._onViewAttachmentsReloaded = () => args.invalidateController();
  }

  /** See [[ViewState.detachFromViewport]]. */
  public override detachFromViewport(): void {
    super.detachFromViewport();
    this._viewAttachments.detachFromViewport();
    this._onViewAttachmentsReloaded = () => undefined;
  }

  public override get areAllTileTreesLoaded(): boolean {
    if (!super.areAllTileTreesLoaded) {
      return false;
    }

    let displayedExtents = this._viewedExtents;
    const frustum = this.calculateFrustum();
    if (frustum) {
      displayedExtents = frustum.toRange();
    }

    return this._viewAttachments.areAllTileTreesLoaded(displayedExtents);
  }

  /** @internal Strictly for testing */
  public areAllAttachmentsLoaded(): boolean {
    return this._viewAttachments.areAllAttachmentsLoaded();
  }

  /** Create a sheet border decoration graphic. */
  private createBorder(width: number, height: number, context: DecorateContext): RenderGraphic {
    const border = SheetBorder.create(width, height, context);
    const builder = context.createGraphicBuilder(GraphicType.ViewBackground);
    border.addToBuilder(builder);
    return builder.finish();
  }

  /** @internal */
  public override decorate(context: DecorateContext): void {
    super.decorate(context);
    if (this.sheetSize !== undefined) {
      const border = this.createBorder(this.sheetSize.x, this.sheetSize.y, context);
      context.setViewBackground(border);
    }
  }

  public override computeFitRange(): Range3d {
    const size = this.sheetSize;
    if (0 >= size.x || 0 >= size.y)
      return super.computeFitRange();
    return new Range3d(0, 0, -1, size.x, size.y, 1);
  }

  /** @internal */
  public override getAttachmentViewport(args: GetAttachmentViewportArgs): Viewport | undefined {
    return this._viewAttachments.getAttachmentViewport(args);
  }

  /** @beta */
  public override computeDisplayTransform(args: ComputeDisplayTransformArgs): Transform | undefined {
    // ###TODO we're currently ignoring model and element Id in args, assuming irrelevant for sheets.
    // Should probably call super or have super call us.
    return this._viewAttachments.computeDisplayTransform(args);
  }
}
