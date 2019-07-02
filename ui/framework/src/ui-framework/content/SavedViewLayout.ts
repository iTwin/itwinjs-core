/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { ContentLayoutProps } from "./ContentLayoutProps";
import { ContentGroupProps, ContentGroup, ContentCallback } from "./ContentGroup";
import { SavedViewProps, SavedView } from "./SavedView";
import { ContentLayoutDef } from "./ContentLayout";
import { ViewState, IModelConnection } from "@bentley/imodeljs-frontend";

/** SavedViewLayoutProps interface for sharing view layout information.
 * @beta
 */
export interface SavedViewLayoutProps {
  contentLayoutProps: ContentLayoutProps;
  contentGroupProps: ContentGroupProps;
  savedViews: SavedViewProps[];
}

/** ViewLayout interface for sharing view layout information.
 * @beta
 */
export interface ViewLayout {
  contentLayoutDef: ContentLayoutDef;
  contentGroup: ContentGroup;
  viewStates: Array<ViewState | undefined>;
}

/** SavedViewLayout class. Used to serialize/deserialize a View Layout with Saved Views.
 * @beta
 */
export class SavedViewLayout {

  /** Create props for a View Layout */
  public static viewLayoutToProps(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup, emphasizeElements: boolean = false, contentCallback?: ContentCallback): SavedViewLayoutProps {

    const contentLayoutProps = contentLayoutDef.toJSON();
    contentLayoutProps.id = "";   // Will generate a new id when ContentLayoutDef is created

    const contentGroupProps = contentGroup.toJSON(contentCallback);

    const savedViews = new Array<SavedViewProps>();
    const viewports = contentGroup.getViewports();
    for (const viewport of viewports) {
      // istanbul ignore else
      if (viewport) {
        const savedViewProps = SavedView.viewStateToProps(viewport.view);
        if (emphasizeElements)
          SavedView.emphasizeElementsToProps(viewport, savedViewProps);
        savedViews.push(savedViewProps);
      }
    }

    const savedViewLayoutProps: SavedViewLayoutProps = {
      contentLayoutProps,
      contentGroupProps,
      savedViews,
    };

    return savedViewLayoutProps;
  }

  /** Create an array of ViewStates from the SavedViewLayout */
  public static async viewStatesFromProps(iModelConnection: IModelConnection, savedProps: SavedViewLayoutProps): Promise<Array<ViewState | undefined>> {
    const viewStates = new Array<ViewState | undefined>();

    for (const savedViewProps of savedProps.savedViews) {
      const viewState = await SavedView.viewStateFromProps(iModelConnection, savedViewProps);
      viewStates.push(viewState);
    }

    return viewStates;
  }

  /** Apply EmphasizeElements from the SavedView */
  public static emphasizeElementsFromProps(contentGroup: ContentGroup, savedProps: SavedViewLayoutProps): boolean {
    const changedList = new Array<boolean>();
    const viewports = contentGroup.getViewports();

    let index = 0;
    for (const savedViewProps of savedProps.savedViews) {
      const viewport = viewports[index];
      // istanbul ignore else
      if (viewport) {
        const changed = SavedView.emphasizeElementsFromProps(viewport, savedViewProps);
        changedList.push(changed);
      }
      index++;
    }

    return changedList.some((changed: boolean) => changed);
  }

}
