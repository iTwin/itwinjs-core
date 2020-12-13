/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Constant, Range3d } from "@bentley/geometry-core";
import { AxisAlignedBox3d, ViewDefinition2dProps, ViewStateProps } from "@bentley/imodeljs-common";
import { ExtentLimits, ViewState2d } from "./ViewState";
import { IModelConnection } from "./IModelConnection";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle2dState } from "./DisplayStyleState";

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

  public isDrawingView(): this is DrawingViewState { return true; }
}
