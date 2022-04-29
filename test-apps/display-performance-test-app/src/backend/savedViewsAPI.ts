/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import got from "got";
import { ViewStateProps } from "@itwin/core-common";
import { IModelHost } from "@itwin/core-backend";

export async function fetchSavedViews(iTwinId: string, iModelId: string, savedViewNames: Set<string>): Promise<SavedViewWithData[]> {
  const savedViewsListResponse = await getAllSavedViews(iTwinId, iModelId);

  const savedViewsToDownload: SavedView[] = [];
  for(const savedViewName of savedViewNames) {
    const foundSavedView = savedViewsListResponse.savedViews.find((sv) => sv.displayName === savedViewName);
    if(foundSavedView === undefined) {
      throw new Error(`Could not find saved view ${savedViewName}`);
    }
    savedViewsToDownload.push(foundSavedView);
  }

  const savedViewResponses = await Promise.all(
    savedViewsToDownload.map(async (sv) => getSavedView(sv.id))
  );

  // Sanity check for the future
  if(savedViewResponses[0].savedView.savedViewData.legacyView === undefined)
    throw new Error("Saved views API no longer returns legacyView");

  return savedViewResponses.map((svr) => svr.savedView);
}

/**
 * Returns all saved view descriptions.
 * To get complete saved view data, call {@link getSavedView}
 * */
async function getAllSavedViews(projectId: string, iModelId: string): Promise<SavedViewListResponse> {
  return got<SavedViewListResponse>(
    `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/savedviews/?projectId=${projectId}&iModelId=${iModelId}`,
    {
      method: "get",
      headers: { Authorization: await IModelHost.getAccessToken() }, // eslint-disable-line @typescript-eslint/naming-convention,
      responseType: "json",
      resolveBodyOnly: true,
    }
  );
}
/** Returns the saved view with the actual view data */
async function getSavedView(savedViewId: string): Promise<SavedViewResponse> {
  return got<SavedViewResponse>(
    `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/savedviews/${savedViewId}`,
    {
      method: "get",
      headers: { Authorization: await IModelHost.getAccessToken() }, // eslint-disable-line @typescript-eslint/naming-convention,
      responseType: "json",
      resolveBodyOnly: true,
    }
  );
}

/*
Saved view types, not complete
*/

interface SavedView {
  id: string;
  displayName: string;
  shared: boolean;
  tags: unknown[];
  _links: unknown; // eslint-disable-line @typescript-eslint/naming-convention
}
interface SavedViewListResponse {
  savedViews: SavedView[];
  _links: unknown; // eslint-disable-line @typescript-eslint/naming-convention
}

interface ViewWithLegacy {
  itwin3dView: unknown;
  itwinSheetView: unknown;
  itwinDrawingView: unknown;
  legacyView: ViewStateProps;
}
type SavedViewWithData = SavedView & {
  savedViewData: ViewWithLegacy;
};
interface SavedViewResponse {
  savedView: SavedViewWithData;
}
