/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { DisplayStyle3dProps, DisplayStyleProps, SpatialViewDefinitionProps, ViewDefinition2dProps } from "@itwin/core-common";
import { TransformProps } from "@itwin/core-geometry";

export const dtaChannel = "display-test-app/dta";

/** Arguments for DtaIpcInterface.createSectionDrawing. */
export interface CreateSectionDrawingViewArgs {
  /** Identifies the writable briefcase in which to create the section drawing. */
  iModelKey: string;
  /** Name used to produce the names of the section drawing element, drawing model, spatial view, model+category selectors, and display style. */
  baseName: string;
  /** Describes the spatial view to be referenced by the drawing. */
  spatialView: SpatialViewDefinitionProps;
  /** The set of models enabled in the spatial view's model selector. */
  models: Id64String[];
  /** The set of categories enabled in the spatial view's category selector. */
  categories: Id64String[];
  /** The display style applied to the spatial view. */
  displayStyle: DisplayStyle3dProps;
  /** A transform from drawing model coordinates to spatial coordinates. */
  drawingToSpatialTransform: TransformProps;
}

/** Arguments for DtaIpcInterface.createDrawing. */
export interface CreateDrawingArgs {
  /** Identifies the writable briefcase in which to create the drawing. */
  iModelKey: string;
  /** Name used to produce the names of the drawing element and drawing model */
  baseName: string;
}

/** Arguments for DtaIpcInterface.insertDrawingView. */
export interface CreateDrawingViewArgs extends CreateDrawingArgs {
  /** Describes the drawing view to be referenced by the drawing. */
  drawingView: ViewDefinition2dProps;
  /** The set of categories enabled in the drawing view's category selector. */
  categories: Id64String[];
  /** The display style applied to the drawing view. */
  displayStyle: DisplayStyleProps;
}

export interface CreateSectionDrawingViewResult {
  sectionDrawingId: Id64String;
  spatialViewId: Id64String;
}

export interface DtaIpcInterface {
  sayHello: () => Promise<string>;

  /** Creates and inserts a copy of the specified spatial view, along with model+category selectors; and a section drawing model and view thereof.
   * Returns the Id of the section drawing view.
   */
  createSectionDrawing(args: CreateSectionDrawingViewArgs): Promise<CreateSectionDrawingViewResult>;

  /**
   * Creates and inserts a drawing element/model. Returns the id of the drawing element/model.
   */
  createDrawing(args: CreateDrawingArgs): Promise<string>;

  /**
   * Creates and inserts a DrawingViewDefinition element.
   */
  insertDrawingView(args: CreateDrawingViewArgs): Promise<any>;
}
