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
import { ToolWidgetComposer } from "./ToolWidgetComposer";
import { useUiVisibility } from "./BasicToolWidget";


/**
 * Empty Tool Widget that can be populated by specifying items for the horizontal and vertical toolbars.
 * This widget can also be populated via a UiItemsProvider.
 * @example
 * ```
 *  const horizontalItems: CommonToolbarItem[] = [
 *    ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
 *    ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef),
 *    ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideSectionToolGroup),
 *    ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateSelectionToolGroup),
 *    ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef),
 *  ];
 *  const verticalItems: CommonToolbarItem[] = [
 *    ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand),
 *    ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.measureToolGroup),
 *    ToolbarHelper.createToolbarItemFromItemDef(30, CoreTools.sectionToolGroup),
 *  ];
 *
 * <SimpleToolWidget horizontalItems={horizontalItems} verticalItems={verticalItems} />
 * ```
 * @beta
 */
export interface SimpleToolWidgetProps {
  /** If default backstage button is desired use <BackstageAppButton />. */
  cornerButton?: React.ReactNode;
  /** optional set of additional items to include in horizontal toolbar */
  horizontalItems?: CommonToolbarItem[];
  /** optional set of additional items to include in vertical toolbar */
  verticalItems?: CommonToolbarItem[];
}

/** Default Tool Widget for standard "review" applications. Provides standard tools to review, and measure elements.
 * This definition will also show a overflow button if there is not enough room to display all the toolbar buttons.
 * @beta
 */
export function SimpleToolWidget(props: SimpleToolWidgetProps) {
  const { cornerButton, horizontalItems, verticalItems } = props;
  const uiIsVisible = useUiVisibility();
  const className = classnames(
    !uiIsVisible && "nz-hidden",
  );

  return (
    <ToolWidgetComposer className={className}
      cornerItem={cornerButton}
      horizontalToolbar={<ToolbarComposer items={horizontalItems ?? []} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems ?? []} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
    />
  );
}
