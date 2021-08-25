/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "@bentley/ui-abstract";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { useUiVisibility } from "./BasicToolWidget";
import { NavigationWidgetComposer } from "./NavigationWidgetComposer";

/** Properties for [[ViewToolWidgetCompose]].
 * @public
 */
export interface ViewToolWidgetComposerProps {
  /** optional set of additional items to include in horizontal toolbar */
  horizontalItems?: CommonToolbarItem[];
  /** optional set of additional items to include in vertical toolbar */
  verticalItems?: CommonToolbarItem[];
  /** Optional Navigation Aid host. If not specified a default host is provided which will use registered Navigation Aids
   * and the active content control to determine which if any Navigation Aid to display. */
  navigationAidHost?: React.ReactNode;
}

/** ViewToolWidgetComposer composes a Navigation Widget with no tools defined by default. Each stage can
 * define a default set of tools for both the horizontal and vertical toolbar when setting up this widget.
 * UiItemsProviders can also provide tools to populate the toolbars.
 *  @example
 * ```
 *  const horizontalItems = ToolbarHelper.createToolbarItemsFromItemDefs([
 *    CoreTools.rotateViewCommand,
 *    CoreTools.panViewCommand,
 *    CoreTools.fitViewCommand,
 *    CoreTools.windowAreaCommand,
 *    CoreTools.viewUndoCommand,
 *    CoreTools.viewRedoCommand,
 *  ]);
 *  const verticalItems = ToolbarHelper.createToolbarItemsFromItemDefs([
 *    CoreTools.walkViewCommand,
 *    CoreTools.toggleCameraViewCommand,
 *  ]);
 *
 * <ViewToolWidgetComposer horizontalItems={horizontalItems} verticalItems={verticalItems} />
 * ```
 * @public
 */
export function ViewToolWidgetComposer(props: ViewToolWidgetComposerProps) {
  const { navigationAidHost, horizontalItems, verticalItems } = props;
  const uiIsVisible = useUiVisibility();
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );

  return (
    <NavigationWidgetComposer className={className} navigationAidHost={navigationAidHost}
      horizontalToolbar={<ToolbarComposer items={horizontalItems ?? []} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems ?? []} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
