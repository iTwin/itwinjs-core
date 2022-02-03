/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import type { CommonToolbarItem} from "@itwin/appui-abstract";
import { ToolbarOrientation, ToolbarUsage } from "@itwin/appui-abstract";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { SelectionContextToolDefinitions } from "../selection/SelectionContextItemDef";
import { ToolbarComposer } from "../toolbar/ToolbarComposer";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import type { UiVisibilityEventArgs } from "../UiFramework";
import { UiFramework } from "../UiFramework";
import { ToolWidgetComposer } from "./ToolWidgetComposer";
import { BackstageAppButton } from "./BackstageAppButton";

/** Properties that can be used to append items to the default set of toolbar items of [[ReviewToolWidget]].
 * @public
 */
export interface BasicToolWidgetProps {
  /** if true include hide/isolate Models and Categories */
  showCategoryAndModelsContextTools?: boolean;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  icon?: string;
  /** optional set of additional items to include in horizontal toolbar */
  additionalHorizontalItems?: CommonToolbarItem[];
  /** optional set of additional items to include in vertical toolbar */
  additionalVerticalItems?: CommonToolbarItem[];
}

/** @internal */
// istanbul ignore next
export function useUiVisibility() {
  const [uiIsVisible, setUiIsVisible] = React.useState(UiFramework.getIsUiVisible());
  React.useEffect(() => {
    const handleUiVisibilityChanged = ((args: UiVisibilityEventArgs): void => setUiIsVisible(args.visible));
    UiFramework.onUiVisibilityChanged.addListener(handleUiVisibilityChanged);
    return () => {
      UiFramework.onUiVisibilityChanged.removeListener(handleUiVisibilityChanged);
    };
  }, []);
  return uiIsVisible;
}

/** Default Tool Widget for standard "review" applications. Provides standard tools to review, and measure elements.
 * This definition will also show a overflow button if there is not enough room to display all the toolbar buttons.
 * @public
 */
export function BasicToolWidget(props: BasicToolWidgetProps) {
  const getHorizontalToolbarItems = React.useCallback(
    (useCategoryAndModelsContextTools: boolean): CommonToolbarItem[] => {
      const items: CommonToolbarItem[] = [];
      if (useCategoryAndModelsContextTools) {
        items.push(
          ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideSectionToolGroup),
          ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateSelectionToolGroup),
          ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef),
        );
      } else {
        items.push(
          ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideElementsItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateElementsItemDef),
          ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef),
        );
      }
      if (props.additionalHorizontalItems)
        items.push(...props.additionalHorizontalItems);
      return items;
    }, [props.additionalHorizontalItems]);

  const getVerticalToolbarItems = React.useCallback(
    (): CommonToolbarItem[] => {
      const items: CommonToolbarItem[] = [];
      items.push(
        ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand),
        ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.measureToolGroup),
        ToolbarHelper.createToolbarItemFromItemDef(30, CoreTools.sectionToolGroup),
      );
      if (props.additionalVerticalItems)
        items.push(...props.additionalVerticalItems);
      return items;
    }, [props.additionalVerticalItems]);

  const [horizontalItems, setHorizontalItems] = React.useState(() => getHorizontalToolbarItems(!!props.showCategoryAndModelsContextTools));
  const [verticalItems, setVerticalItems] = React.useState(() => getVerticalToolbarItems());

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setHorizontalItems(getHorizontalToolbarItems(!!props.showCategoryAndModelsContextTools));
      setVerticalItems(getVerticalToolbarItems());
    }
  }, [props.showCategoryAndModelsContextTools, props.additionalHorizontalItems, props.additionalVerticalItems, getHorizontalToolbarItems, getVerticalToolbarItems]);

  const uiIsVisible = useUiVisibility();
  // istanbul ignore next
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );
  return (
    <ToolWidgetComposer className={className}
      cornerItem={<BackstageAppButton icon={props.icon} />}
      horizontalToolbar={<ToolbarComposer items={horizontalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
