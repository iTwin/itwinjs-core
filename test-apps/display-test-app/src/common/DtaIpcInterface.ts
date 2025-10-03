/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { DisplayStyle3dProps, Placement2dProps, SpatialViewDefinitionProps, TextAnnotationProps, TextStyleSettingsProps } from "@itwin/core-common";
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
   * Inserts an annotation text style into the specified iModel.
   * Returns the ID of the inserted text style element.
   */
  insertTextStyle(iModelKey: string, name: string, settingProps: TextStyleSettingsProps): Promise<Id64String>;

  /**
   * Looks up the specified text style by name in the specified iModel and updates its settings.
   */
  updateTextStyle(iModelKey: string, name: string, newSettingProps: TextStyleSettingsProps): Promise<void>;

  /**
   * Looks up the specified text style by name in the specified iModel and deletes it.
   */
  deleteTextStyle(iModelKey: string, name: string): Promise<void>;

  /**
   * Inserts a text annotation into the specified iModel.
   */
  insertText(iModelKey: string, categoryId: Id64String, modelId: Id64String, placement: Placement2dProps, defaultTextStyleId: Id64String, textAnnotationProps?: TextAnnotationProps): Promise<Id64String>;

  /**
   * Updates an existing text annotation in the specified iModel.
   */
  updateText(iModelKey: string, elementId: Id64String, categoryId?: Id64String, placement?: Placement2dProps, defaultTextStyleId?: Id64String, textAnnotationProps?: TextAnnotationProps): Promise<void>;

  /**
   * Deletes an existing text annotation in the specified iModel.
   */
  deleteText(iModelKey: string, elementId: Id64String): Promise<void>;

  /**
   * If the model is a DrawingModel, sets the scale factor on the Drawing element.
   */
  setScaleFactor(iModelKey: string, modelId: Id64String, scaleFactor: number): Promise<void>;
}
