/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Id64String } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import type { DisplayStyle, DrawingViewDefinition, IModelDb, ViewDefinition } from "@itwin/core-backend";
import type { ColorDef, ViewQueryParams } from "@itwin/core-common";

// __PUBLISH_EXTRACT_START__ IModelDb.Views.iterateViews
/**
 * Return an array of all views of a specified drawing model.
 * @param iModel The IModelDb in which to query
 * @param drawingModelId The Id of the DrawingModel of interest
 * @param includePrivate Whether or not to include views marked as 'private'
 * @return An array of all of the views which are configured to view the specified drawing model.
 */
function findViewsOfDrawingModel(iModel: IModelDb, drawingModelId: Id64String, includePrivate: boolean = false): DrawingViewDefinition[] {
  let where = `BaseModel.Id=${drawingModelId}`; // Limit query to those views which look at the specified model
  if (!includePrivate)
    where += " AND IsPrivate=FALSE"; // Exclude private views if specified

  const views: DrawingViewDefinition[] = [];
  const params: ViewQueryParams = { from: "BisCore.DrawingViewDefinition", where };
  iModel.views.iterateViews(params, (view: ViewDefinition) => {
    if (view.isDrawingView())
      views.push(view);

    return true; // indicates we want to continue iterating the set of views.
  });

  return views;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ ViewDefinition.getBackgroundColor
/** Given a ViewDefinition, return its background color.
 * @param view The ViewDefinition of interest.
 * @return The background color for the view.
 * @note This is a convenience function intended to demonstrate the API. The background color is defined on the ViewDefinition's DisplayStyle. If multiple properties of the DisplayStyle are of interest, it would be more efficient to obtain the DisplayStyle via ViewDefinition.loadDisplayStyle() directly.
 */
function getViewBackgroundColor(view: ViewDefinition): ColorDef {
  const displayStyle: DisplayStyle = view.loadDisplayStyle(); // Load the view's display style from the IModelDb.
  return displayStyle.settings.backgroundColor; // Extract the background color.
}
// __PUBLISH_EXTRACT_END__

const imodel = {} as IModelDb;
findViewsOfDrawingModel(imodel, Id64.invalid);
const fakeView = {} as ViewDefinition;
getViewBackgroundColor(fakeView);
