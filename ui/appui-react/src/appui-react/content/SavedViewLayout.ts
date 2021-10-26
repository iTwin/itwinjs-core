/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import { IModelConnection, ViewState } from "@itwin/core-frontend";
import { ContentCallback, ContentGroup, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutDef } from "./ContentLayout";
import { SavedView, SavedViewProps } from "./SavedView";
import { ContentLayoutProps } from "@itwin/appui-abstract";

/** SavedViewLayoutProps interface for sharing view layout information.
 * @public
 */
export interface SavedViewLayoutProps {
  contentLayoutProps?: ContentLayoutProps;
  contentGroupProps: ContentGroupProps;
  savedViews: SavedViewProps[];
}

/** ViewLayout interface for sharing view layout information.
 * @public
 */
export interface ViewLayout {
  contentLayoutDef: ContentLayoutDef;
  contentGroup: ContentGroup;
  viewStates: Array<ViewState | undefined>;
}

/** SavedViewLayout class. Used to serialize/deserialize a View Layout with Saved Views.
 * @public
 */
export class SavedViewLayout {
  /** Create props for a View Layout */
  public static viewLayoutToProps(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup, emphasizeElements: boolean = false, contentCallback?: ContentCallback): SavedViewLayoutProps {
    const contentLayoutProps = contentLayoutDef.toJSON();
    // update layout in contentGroup to contain latest values from contentLayoutDef this way we don't need to save both.
    const contentGroupProps = { ...contentGroup.toJSON(contentCallback), layout: contentLayoutProps };
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
