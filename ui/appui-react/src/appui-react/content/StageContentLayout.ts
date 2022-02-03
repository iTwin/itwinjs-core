/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import type { IModelConnection, ViewState } from "@itwin/core-frontend";
import type { ContentCallback, ContentGroup, ContentGroupProps } from "./ContentGroup";
import type { ContentLayoutDef } from "./ContentLayout";
import type { ViewStateHelperProps } from "./ViewStateHelper";
import { ViewStateHelper } from "./ViewStateHelper";
import type { ContentLayoutProps } from "@itwin/appui-abstract";

/** StageContentLayoutProps interface for sharing view layout information.
 * @public
 */
export interface StageContentLayoutProps {
  contentLayoutProps?: ContentLayoutProps;
  contentGroupProps: ContentGroupProps;
  viewStateProps: ViewStateHelperProps[];
}

/** ViewLayout interface for sharing view layout information.
 * @public
 */
export interface ViewLayout {
  contentLayoutDef: ContentLayoutDef;
  contentGroup: ContentGroup;
  viewStates: Array<ViewState | undefined>;
}

/** StageContentLayout class. Used to serialize/deserialize a View Layout with Saved Views.
 * @public
 */
export class StageContentLayout {
  /** Create props for a View Layout */
  public static viewLayoutToProps(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup, emphasizeElements: boolean = false, contentCallback?: ContentCallback): StageContentLayoutProps {
    const contentLayoutProps = contentLayoutDef.toJSON();
    // update layout in contentGroup to contain latest values from contentLayoutDef this way we don't need to save both.
    const contentGroupProps = { ...contentGroup.toJSON(contentCallback), layout: contentLayoutProps };
    const viewStateProps = new Array<ViewStateHelperProps>();
    const viewports = contentGroup.getViewports();
    for (const viewport of viewports) {
      // istanbul ignore else
      if (viewport) {
        const savedViewProps = ViewStateHelper.viewStateToProps(viewport.view);
        if (emphasizeElements)
          ViewStateHelper.emphasizeElementsToProps(viewport, savedViewProps);
        viewStateProps.push(savedViewProps);
      }
    }

    const savedViewLayoutProps: StageContentLayoutProps = {
      contentGroupProps,
      viewStateProps,
    };

    return savedViewLayoutProps;
  }

  /** Create an array of ViewStates from the StageContentLayout */
  public static async viewStatesFromProps(iModelConnection: IModelConnection, savedProps: StageContentLayoutProps): Promise<Array<ViewState | undefined>> {
    const viewStates = new Array<ViewState | undefined>();

    if (savedProps.viewStateProps) {
      for (const savedViewProps of savedProps.viewStateProps) {
        const viewState = await ViewStateHelper.viewStateFromProps(iModelConnection, savedViewProps);
        viewStates.push(viewState);
      }
    }

    return viewStates;
  }

  /** Apply EmphasizeElements from the SavedView */
  public static emphasizeElementsFromProps(contentGroup: ContentGroup, savedProps: StageContentLayoutProps): boolean {
    const changedList = new Array<boolean>();
    const viewports = contentGroup.getViewports();

    let index = 0;
    for (const savedViewProps of savedProps.viewStateProps) {
      const viewport = viewports[index];
      // istanbul ignore else
      if (viewport) {
        const changed = ViewStateHelper.emphasizeElementsFromProps(viewport, savedViewProps);
        changedList.push(changed);
      }
      index++;
    }

    return changedList.some((changed: boolean) => changed);
  }
}
