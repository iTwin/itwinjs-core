/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { ViewQueryParams } from "@bentley/imodeljs-common";
import { IModelDb, ViewDefinition, DrawingViewDefinition } from "@bentley/imodeljs-backend";

// __PUBLISH_EXTRACT_START__ ViewDefinition.iterateViews
/**
 * Return an array of all views of a specified drawing model.
 * @param iModel: The IModelDb in which to query
 * @param drawingModelId: The ID of the DrawingModel of interest
 * @param includePrivate: Whether or not to include views marked as 'private'
 * @return An array of all of the views which are configured to view the specified drawing model.
 */
function findViewsOfDrawingModel(iModel: IModelDb, drawingModelId: Id64, includePrivate: boolean = false): DrawingViewDefinition[] {
  let where = "BaseModel.Id=" + drawingModelId.value; // Limit query to those views which look at the specified model
  if (!includePrivate)
    where += " AND IsPrivate=FALSE"; // Exclude private views if specified

  const views: DrawingViewDefinition[] = [];
  const params: ViewQueryParams = { from: "BisCore.DrawingViewDefinition", where, };
  iModel.views.iterateViews(params, (view: ViewDefinition) => {
    if (view.isDrawingView())
      views.push(view);

    return true; // indicates we want to continue iterating the set of views.
  });

  return views;
}
// __PUBLISH_EXTRACT_END__

const imodel = {} as IModelDb;
findViewsOfDrawingModel(imodel, Id64.invalidId);
