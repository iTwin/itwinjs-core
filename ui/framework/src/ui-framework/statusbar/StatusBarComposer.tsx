/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import {
  StatusBarItemsManager, CommonStatusBarItem, isAbstractStatusBarActionItem, AbstractStatusBarActionItem,
  isAbstractStatusBarLabelItem, AbstractStatusBarLabelItem, StatusbarLabelSide, StatusBarSection,
} from "@bentley/ui-abstract";
import { Icon } from "@bentley/ui-core";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { StatusBarSpaceBetween, StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection, StatusBarContext } from "./StatusBar";
import { isStatusBarItem } from "./StatusBarItem";
import { useStageStatusBarItems } from "./useStageStatusBarItems";
import { usePluginStatusBarItems } from "./usePluginStatusBarItems";
import { Indicator } from "../statusfields/Indicator";

/** function to produce a StatusBarItem component from an AbstractStatusBarLabelItem */
function generateActionStatusLabelItem(item: AbstractStatusBarLabelItem, isInFooterMode: boolean): React.ReactNode {
  const iconPaddingClass = item.labelSide === StatusbarLabelSide.Left ? "nz-icon-padding-right" : "nz-icon-padding-left";
  return (<FooterIndicator
    isInFooterMode={isInFooterMode}
  >
    {item.icon && <Icon iconSpec={item.icon} />}
    {item.label && <span className={iconPaddingClass}>{item.label}</span>}
  </FooterIndicator>
  );
}

/** function to produce a StatusBarItem component from an AbstractStatusBarActionItem */
function generateActionStatusBarItem(item: AbstractStatusBarActionItem, isInFooterMode: boolean): React.ReactNode {
  return <Indicator toolTip={item.tooltip ? item.tooltip : item.label} opened={false} onClick={item.execute} iconName={item.icon}
    isInFooterMode={isInFooterMode} />;
}

/** local function to combine items from Stage and from Plugins */
function combineItems(stageItems: ReadonlyArray<CommonStatusBarItem>, pluginItems: ReadonlyArray<CommonStatusBarItem>) {
  const items: CommonStatusBarItem[] = [];
  if (stageItems.length)
    items.push(...stageItems);
  if (pluginItems.length)
    items.push(...pluginItems);
  return items;
}

/** Properties for the [[StatusBarComposer]] React components
 * @beta
 */
export interface StatusBarComposerProps {
  /** StatusBar items manager containing status fields */
  itemsManager: StatusBarItemsManager;
  /** If specified is used to managed statusbar items provided from plugins */
  pluginItemsManager?: StatusBarItemsManager;
}

/** Component to load components into the [[StatusBar]].
 * @beta
 */
// tslint:disable-next-line: variable-name
export const StatusBarComposer: React.FC<StatusBarComposerProps> = (props) => {
  const statusBarContext = React.useContext(StatusBarContext);
  const { itemsManager, pluginItemsManager } = props;
  const stageItems = useStageStatusBarItems(itemsManager);
  const pluginItems = usePluginStatusBarItems(pluginItemsManager);
  const statusBarItems = React.useMemo(() => combineItems(stageItems, pluginItems), [stageItems, pluginItems]);

  const getComponent = (item: CommonStatusBarItem): React.ReactNode => {
    if (isStatusBarItem(item)) {
      return item.reactNode;
    }

    if (isAbstractStatusBarActionItem(item))
      return generateActionStatusBarItem(item, statusBarContext.isInFooterMode);

    // istanbul ignore if
    if (!isAbstractStatusBarLabelItem(item))
      return null;

    return generateActionStatusLabelItem(item, statusBarContext.isInFooterMode);
  };

  const getSectionItems = (section: StatusBarSection): React.ReactNode[] => {
    const sectionItems = statusBarItems
      .filter((item) => item.section as number === section && item.isVisible)
      .sort((a, b) => a.itemPriority - b.itemPriority);

    return sectionItems.map((sectionItem) => (
      <React.Fragment key={sectionItem.id}>
        {getComponent(sectionItem)}
      </React.Fragment>
    ));
  };

  const leftItems = getSectionItems(StatusBarSection.Left);
  const centerItems = getSectionItems(StatusBarSection.Center);
  const rightItems = getSectionItems(StatusBarSection.Right);
  const contextItems = getSectionItems(StatusBarSection.Context);

  return (
    <StatusBarSpaceBetween>
      <StatusBarLeftSection>
        {leftItems}
      </StatusBarLeftSection>
      <StatusBarCenterSection>
        {centerItems}
        {contextItems}
      </StatusBarCenterSection>
      <StatusBarRightSection>
        {rightItems}
      </StatusBarRightSection>
    </StatusBarSpaceBetween>
  );
};
