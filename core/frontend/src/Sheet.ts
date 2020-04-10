/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64Array } from "@bentley/bentleyjs-core";
import {
  Angle,
  Constant,
  Point2d,
  Point3d,
  Range2d,
  Range3d,
} from "@bentley/geometry-core";
import {
  AxisAlignedBox3d,
  ColorDef,
  Gradient,
  GraphicParams,
  SheetProps,
  ViewAttachmentProps,
  ViewDefinition2dProps,
  ViewStateProps,
} from "@bentley/imodeljs-common";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle2dState } from "./DisplayStyleState";
import { IModelConnection } from "./IModelConnection";
import { GraphicBuilder, GraphicType } from "./render/GraphicBuilder";
import { RenderGraphic } from "./render/RenderGraphic";
import { RenderTarget } from "./render/RenderTarget";
import { DecorateContext, SceneContext } from "./ViewContext";
import { Viewport } from "./Viewport";
import { ViewState, ViewState2d } from "./ViewState";
import {
  AttachmentList,
  AttachmentSceneState,
  createAttachment,
  TileTreeSet,
} from "./tile/internal";

// cSpell:ignore ovrs

/** Describes the geometry and styling of a sheet border decoration.
 * The sheet border decoration mimics a sheet of paper with a drop shadow.
 * @internal
 */
export class SheetBorder {
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
    // ### TODO: Allow for conversion of 2d points array to view coordinates from world coordinates to avoid these copies?..
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
    params.setFillColor(fillColor);
    params.gradient = this._gradient;

    builder.activateGraphicParams(params);
    builder.addShape2d(this._shadow, RenderTarget.frustumDepth2d);

    builder.setSymbology(lineColor, fillColor, 2);
    builder.addLineString2d(this._rect, 0);
  }
}

/** A view of a [SheetModel]($backend).
 * @public
 */
export class SheetViewState extends ViewState2d {
  /** The width and height of the sheet in world coordinates. */
  public readonly sheetSize: Point2d;
  private _attachmentIds: Id64Array;
  private _attachments: AttachmentList;
  private _all3dAttachmentTilesLoaded: boolean = true;
  private readonly _viewedExtents: AxisAlignedBox3d;

  /** @internal */
  public static get className() { return "SheetViewDefinition"; }
  public static createFromProps(viewStateData: ViewStateProps, iModel: IModelConnection): SheetViewState {
    const cat = new CategorySelectorState(viewStateData.categorySelectorProps, iModel);
    const displayStyleState = new DisplayStyle2dState(viewStateData.displayStyleProps, iModel);
    // use "new this" so subclasses are correct
    return new this(viewStateData.viewDefinitionProps as ViewDefinition2dProps, iModel, cat, displayStyleState, viewStateData.sheetProps!, viewStateData.sheetAttachments!);
  }

  public constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState, sheetProps: SheetProps, attachments: Id64Array) {
    super(props, iModel, categories, displayStyle);
    if (categories instanceof SheetViewState) {
      // we are coming from clone...
      this.sheetSize = categories.sheetSize.clone();
      this._attachmentIds = categories._attachmentIds;
      this._attachments = categories._attachments;
      this._viewedExtents = categories._viewedExtents.clone();
    } else {
      this.sheetSize = Point2d.create(sheetProps.width, sheetProps.height);
      this._attachmentIds = [];
      attachments.forEach((idProp) => this._attachmentIds.push(idProp));
      this._attachments = new AttachmentList();

      const extents = new Range3d(0, 0, 0, this.sheetSize.x, this.sheetSize.y, 0);
      const margin = 1.1;
      extents.scaleAboutCenterInPlace(margin);
      this._viewedExtents = extents;
    }
  }

  /** Disclose *all* TileTrees currently in use by this view. This set may include trees not reported by [[forEachTileTreeRef]] - e.g., those used by view attachments, map-draped terrain, etc.
   * @internal
   */
  public discloseTileTrees(trees: TileTreeSet): void {
    super.discloseTileTrees(trees);
    for (const attachment of this._attachments.list) {
      trees.disclose(attachment);
    }
  }

  /** @internal */
  public get attachmentIds() { return this._attachmentIds; }

  /** @internal */
  public get defaultExtentLimits() {
    return { min: Constant.oneMillimeter, max: this.sheetSize.magnitude() * 10 };
  }

  /** @internal */
  public getViewedExtents(): AxisAlignedBox3d {
    return this._viewedExtents;
  }

  /** Manually mark this SheetViewState as having to re-create its scene due to still-loading tiles for 3d attachments. This is called directly from the attachment tiles.
   * @internal
   */
  public markAttachment3dSceneIncomplete() {
    // NB: 2d attachments will draw to completion once they have a tile tree... but 3d attachments create new tiles for each
    // depth, and therefore report directly to the ViewState whether or not new tiles are being loaded
    this._all3dAttachmentTilesLoaded = false;
  }

  /** Load the size and attachment for this sheet, as well as any other 2d view state characteristics.
   * @internal
   */
  public async load(): Promise<void> {
    await super.load();

    // Set the size of the sheet
    const model = this.getViewedModel();
    if (model === undefined)
      return;

    this._attachments.clear();

    // Query all of the attachment properties using their ids
    const attachmentPropList = await this.iModel.elements.getProps(this._attachmentIds) as ViewAttachmentProps[];

    // For each ViewAttachmentProps, load the view that the attachment references. Once the view is loaded, officially construct the attachment & add it to the array.
    for (const attachmentProps of attachmentPropList) {
      this.iModel.views.load(attachmentProps.view.id).then((view: ViewState) => { // tslint:disable-line:no-floating-promises
        this._attachments.add(createAttachment(attachmentProps, view));
      });
    }
  }

  /** If any attachments have not yet been loaded or are waiting on tiles, invalidate the scene.
   * @internal
   */
  public onRenderFrame(_viewport: Viewport) {
    if (!this._attachments.allReady || !this._all3dAttachmentTilesLoaded)
      _viewport.invalidateScene();
  }

  /** Adds the Sheet view to the scene, along with any of this sheet's attachments.
   * @internal
   */
  public createScene(context: SceneContext) {
    // This will be set to false by the end of the function if any 3d attachments are waiting on tiles...
    this._all3dAttachmentTilesLoaded = true;

    super.createScene(context);

    if (!this._attachments.allReady) {
      let i = 0;
      while (i < this._attachments.length) {
        const loadStatus = this._attachments.load(i, this, context);

        // If load fails, attachment gets dropped from the list
        if (loadStatus === AttachmentSceneState.Ready || loadStatus === AttachmentSceneState.Loading)
          i++;
      }
    }

    // Draw all attachments that have a status of ready
    for (const attachment of this._attachments.list)
      attachment.draw(context);
  }

  /** Create a sheet border decoration graphic. */
  private createBorder(width: number, height: number, context: DecorateContext): RenderGraphic {
    const border = SheetBorder.create(width, height, context);
    const builder = context.createGraphicBuilder(GraphicType.ViewBackground);
    border.addToBuilder(builder);
    return builder.finish();
  }

  /** @internal */
  public decorate(context: DecorateContext): void {
    super.decorate(context);
    if (this.sheetSize !== undefined) {
      const border = this.createBorder(this.sheetSize.x, this.sheetSize.y, context);
      context.setViewBackground(border);
    }
  }

  /** @internal */
  public computeFitRange(): Range3d {
    const size = this.sheetSize;
    if (0 >= size.x || 0 >= size.y)
      return super.computeFitRange();
    return new Range3d(0, 0, -1, size.x, size.y, 1);
  }
}
