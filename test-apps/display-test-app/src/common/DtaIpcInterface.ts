/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AnnotationTextStyleCreateArgs, TextAnnotation2dCreateArgs } from "@itwin/core-backend";
import { Id64String } from "@itwin/core-bentley";
import { DisplayStyle3dProps, Placement2dProps, SpatialViewDefinitionProps } from "@itwin/core-common";
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

export interface CreateTextAnnotationArgs {
  iModelKey: string;
  annotationCreateArgs: TextAnnotation2dCreateArgs;
}

export interface UpdateTextAnnotationArgs {
  iModelKey: string;
  annotationUpdateArgs: Omit<TextAnnotation2dCreateArgs, "model" | "category" | "placement"> & { placement?: Placement2dProps};
}

export interface CreateTextStyleArgs {
  iModelKey: string;
  textStyleCreateArgs: Omit<AnnotationTextStyleCreateArgs, "iModelDb" | "definitionModelId">;
}

export interface UpdateTextStyleArgs {
  iModelKey: string;
  textStyleUpdateArgs: Omit<AnnotationTextStyleCreateArgs, "iModelDb" | "definitionModelId" | "name"> & { name?: string };
}

export interface DtaIpcInterface {
  sayHello: () => Promise<string>;

  /** Creates and inserts a copy of the specified spatial view, along with model+category selectors; and a section drawing model and view thereof.
   * Returns the Id of the section drawing view.
   */
  createSectionDrawing(args: CreateSectionDrawingViewArgs): Promise<CreateSectionDrawingViewResult>;
  insertTextAnnotation2d(args: CreateTextAnnotationArgs): Promise<string>;
  updateTextAnnotation2d(elementId: Id64String, args: UpdateTextAnnotationArgs): Promise<void>;
  insertAnnotationTextStyle(args: CreateTextStyleArgs): Promise<string>;
  updateAnnotationTextStyle(elementId: Id64String, args: UpdateTextStyleArgs): Promise<void>;
  deleteTextAnnotations(args: {iModelKey: string}): Promise<void>;
  upgradeSchemas(fileName: string): Promise<void>;
  schemaVersion(args: {iModelKey: string}): Promise<string | undefined>;
  importSchema(args: {iModelKey: string}): Promise<string | undefined>;
}
