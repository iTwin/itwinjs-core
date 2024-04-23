/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { DisplayStyle3dProps, SpatialViewDefinitionProps } from "@itwin/core-common";
import { TransformProps } from "@itwin/core-geometry";

export const dtaChannel = "display-test-app/dta";

export interface CreateSectionDrawingViewArgs {
  iModelKey: string;
  baseName: string;
  spatialView: SpatialViewDefinitionProps;
  models: Id64String[];
  categories: Id64String[];
  displayStyle: DisplayStyle3dProps;
  drawingToSpatialTransform: TransformProps;
}

export interface DtaIpcInterface {
  sayHello: () => Promise<string>;

  /** Creates and inserts a copy of the specified spatial view, along with model+category selectors; and a section drawing model and view thereof.
   * Returns the Id of the section drawing view.
   */
  createSectionDrawing(args: CreateSectionDrawingViewArgs): Promise<Id64String>;
}
