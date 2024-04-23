/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { CodeProps, DisplayStyle3dProps, ElementProps, SpatialViewDefinitionProps, ViewDefinition2dProps } from "@itwin/core-common";
import { Range3dProps, TransformProps } from "@itwin/core-geometry";

export interface CreateSectionDrawingViewArgs {
  baseName: string;
  spatialView: SpatialViewDefinitionProps;
  models: Id64String[];
  categories: Id64String[];
  displayStyle: Id64String | DisplayStyle3dProps;
  drawingToSpatialTransform: TransformProps;
}

export const sectionDrawingChannel = "SectionDrawingChannel";
export interface SectionDrawingIpc {
  setup: (briefcaseDbKey: string) => Promise<void>;
  /**
   * Insert a section drawing and model.
   * @param name Name of the section drawing
   * @param spatialViewDefinitionId Id of the spatial view definition shown in the section drawing.
   */
  insertSectionDrawing(name: string, spatialViewDefinitionId: string, transform?: TransformProps): Promise<string>;
  updateSectionDrawingTransform(sectionDrawingId: string, drawingToSpatial: TransformProps): Promise<boolean>;
  /**
   * Insert a drawing view definition viewing a section drawing.
   * @param drawingViewDefinition2dProps Props for creating a drawing view definition
   * @param name Name of the section drawing AND drawing view state
   */
  insertSectionDrawingViewState(drawingViewDefinition2dProps: ViewDefinition2dProps, name: string): Promise<string>;

  /**
   * The section drawing view needs to account for both the extents of the underlying SectionDrawingModel and the extents of the referenced SpatialView.
   * @param spatialViewDefinitionId
   * @param sectionDrawingModelId
   * @returns The union of the SectionDrawingModel extents and the SpatialView extents as Range3dProps
   */
  calculateDrawingViewExtents(spatialViewDefinitionId: string, sectionDrawingModelId: string, drawingToSpatial: TransformProps | undefined): Promise<Range3dProps>;

  spatialViewDefinitionCode(name: string): Promise<CodeProps>;
  /**
   * Insert any BIS element based on the props
   * @param props The props used to insert the BIS element. Determines which element class gets created
   * @param locks The ids of elements/models that need to be locked when creating the element
   * @returns The id of the created element
   */
  insertElement(props: ElementProps, locks: string[]): Promise<string>;

  /** Creates and inserts a copy of the specified spatial view, along with model+category selectors; and a section drawing model and view thereof.
   * Returns the Id of the section drawing view.
   */
  createSectionDrawingView(args: CreateSectionDrawingViewArgs): Promise<Id64String>;
}
