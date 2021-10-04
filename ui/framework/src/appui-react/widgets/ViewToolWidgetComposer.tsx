/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { ToolbarOrientation, ToolbarUsage } from "@itwin/appui-abstract";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { useUiVisibility } from "./BasicToolWidget";
import { NavigationWidgetComposer } from "./NavigationWidgetComposer";

/**
 * Props for [[ViewToolWidgetComposer]].
 * @public
 */
export interface ViewToolWidgetComposerProps {
  /** If true no navigation aid will be shown. Defaults to false. */
  hideNavigationAid?: boolean;
}

/**
 * ViewToolWidgetComposer composes a Navigation Widget with no tools defined by default. UiItemsProviders
 * must be used to provide tools to populate the toolbars. See [[StandardNavigationToolsProvider]].
 *  @example
 * ```
 * <ViewToolWidgetComposer />
 * ```
 * If no NavigationAid control is to be shown set hideNavigationAid.
 *  * ```
 * <ViewToolWidgetComposer hideNavigationAid />
 * ```

 * @public
 */
export function ViewToolWidgetComposer(props: ViewToolWidgetComposerProps) {
  const uiIsVisible = useUiVisibility();
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );

  return (
    <NavigationWidgetComposer className={className} hideNavigationAid={props.hideNavigationAid}
      horizontalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
