/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ViewStateProps } from "@itwin/core-common";
import { ViewStateSpec } from "./TestConfig";

export class SavedViewsFetcher {
  private readonly _cache: {[iModelId: string]: ViewStateSpec[]} = {};

  public async getSavedViews(
    iTwinId: string,
    iModelId: string,
    accessToken: string,
  ): Promise<ViewStateSpec[]> {
    if(this._cache[iModelId])
      return this._cache[iModelId];

    const savedViewsList = await fetchSavedViewsList(iTwinId, iModelId, accessToken);

    const savedViews = await Promise.all(
      savedViewsList.savedViews.map(async (sv) => fetchSavedView(sv.id, accessToken)),
    );

    // Sanity check for the future
    if(savedViews[0].savedView.savedViewData.legacyView === undefined)
      throw new Error("Saved views API no longer returns legacyView");

    const viewStateSpecs = savedViews.map((sv) => ({
      name: sv.savedView.displayName,
      viewProps: sv.savedView.savedViewData.legacyView,
      elementOverrides: undefined, // api does not provide this
      selectedElements: undefined, // api does not provide this
    } as ViewStateSpec));

    this._cache[iModelId] = viewStateSpecs;
    return viewStateSpecs;
  }
}

// Below: saved views API with incomplete types

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
  legacyView: ViewStateProps; // What we care about
}
type SavedViewWithData = SavedView & {
  savedViewData: ViewWithLegacy;
};
interface SavedViewResponse {
  savedView: SavedViewWithData;
}

/**
 * Returns all saved view descriptions.
 * To get complete saved view data, call {@link fetchSavedView}
 * */
async function fetchSavedViewsList(projectId: string, iModelId: string, accessToken: string): Promise<SavedViewListResponse> {
  return fetch(
    `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/savedviews/?projectId=${projectId}&iModelId=${iModelId}`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken, // eslint-disable-line @typescript-eslint/naming-convention
      },
    }).then(async (response) => response.json());
}

/** Returns the saved view with the actual view data */
async function fetchSavedView(savedViewId: string, accessToken: string): Promise<SavedViewResponse> {
  return fetch(
    `https://${process.env.IMJS_URL_PREFIX}api.bentley.com/savedviews/${savedViewId}`,
    {
      method: "GET",
      headers: {
        Authorization: accessToken, // eslint-disable-line @typescript-eslint/naming-convention
      },
    },
  ).then(async (response) => response.json());
}
