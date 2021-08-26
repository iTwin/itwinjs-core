/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { ToolbarOrientation, ToolbarUsage } from "@bentley/ui-abstract";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { useUiVisibility } from "./BasicToolWidget";
import { NavigationWidgetComposer } from "./NavigationWidgetComposer";

/**
 * ViewToolWidgetComposer composes a Navigation Widget with no tools defined by default. UiItemsProviders
 * must be used to provide tools to populate the toolbars. See [[StandardNavigationToolsProvider]].
 *  @example
 * ```
 * <ViewToolWidgetComposer />
 * ```
 * @public
 */
export function ViewToolWidgetComposer() {
  const uiIsVisible = useUiVisibility();
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );

  return (
    <NavigationWidgetComposer className={className}
      horizontalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={[]} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
