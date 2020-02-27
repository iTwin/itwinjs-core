/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import {
  StatusBarItemsManager, CommonStatusBarItem, isAbstractStatusBarActionItem, AbstractStatusBarActionItem,
  isAbstractStatusBarLabelItem, AbstractStatusBarLabelItem, StatusBarLabelSide, StatusBarSection, ConditionalStringValue, ConditionalBooleanValue,
} from "@bentley/ui-abstract";
import { Icon } from "@bentley/ui-core";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { StatusBarSpaceBetween, StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection, StatusBarContext } from "./StatusBar";
import { isStatusBarItem } from "./StatusBarItem";
import { useDefaultStatusBarItems } from "./useDefaultStatusBarItems";
import { useUiItemsProviderStatusBarItems } from "./useUiItemsProviderStatusBarItems";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../../ui-framework";
import { Indicator } from "../statusfields/Indicator";

/** Private function to set up sync event monitoring of statusbar items */
function useStatusBarItemSyncEffect(itemsManager: StatusBarItemsManager, syncIdsOfInterest: string[]) {
  React.useEffect(() => {
    const handleSyncUiEvent = (args: SyncUiEventArgs) => {
      if (0 === syncIdsOfInterest.length)
        return;

      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        // process each item that has interest
        itemsManager.refreshAffectedItems(args.eventIds);
      }
    };

    // Note: that items with conditions have condition run when loaded into the items manager
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [itemsManager, itemsManager.items, syncIdsOfInterest]);
}

/** function to produce a StatusBarItem component from an AbstractStatusBarLabelItem */
function generateActionStatusLabelItem(item: AbstractStatusBarLabelItem, isInFooterMode: boolean): React.ReactNode {
  const iconPaddingClass = item.labelSide === StatusBarLabelSide.Left ? "nz-icon-padding-right" : "nz-icon-padding-left";
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
  return <Indicator toolTip={ConditionalStringValue.getValue(item.tooltip)} opened={false} onClick={item.execute} iconName={ConditionalStringValue.getValue(item.icon)}
    isInFooterMode={isInFooterMode} />;
}

/** local function to combine items from Stage and from Plugins */
function combineItems(stageItems: ReadonlyArray<CommonStatusBarItem>, addonItems: ReadonlyArray<CommonStatusBarItem>) {
  const items: CommonStatusBarItem[] = [];
  if (stageItems.length)
    items.push(...stageItems);
  if (addonItems.length)
    items.push(...addonItems);
  return items;
}

/** Properties for the [[StatusBarComposer]] React components
 * @beta
 */
export interface StatusBarComposerProps {
  items: CommonStatusBarItem[];
}

/** Component to load components into the [[StatusBar]].
 * @beta
 */
export function StatusBarComposer(props: StatusBarComposerProps) {
  const [defaultItemsManager, setDefaultItemsManager] = React.useState(new StatusBarItemsManager(props.items));
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setDefaultItemsManager(new StatusBarItemsManager(props.items));
    }
  }, [props.items]);
  const defaultItems = useDefaultStatusBarItems(defaultItemsManager);
  const syncIdsOfInterest = React.useMemo(() => StatusBarItemsManager.getSyncIdsOfInterest(defaultItems), [defaultItems]);
  useStatusBarItemSyncEffect(defaultItemsManager, syncIdsOfInterest);

  const statusBarContext = React.useContext(StatusBarContext);
  const [addonItemsManager] = React.useState(new StatusBarItemsManager());
  const addonItems = useUiItemsProviderStatusBarItems(addonItemsManager);
  const addonSyncIdsOfInterest = React.useMemo(() => StatusBarItemsManager.getSyncIdsOfInterest(addonItems), [addonItems]);
  useStatusBarItemSyncEffect(addonItemsManager, addonSyncIdsOfInterest);

  const statusBarItems = React.useMemo(() => combineItems(defaultItems, addonItems), [defaultItems, addonItems]);

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
      .filter((item) => item.section as number === section && !ConditionalBooleanValue.getValue(item.isHidden))
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
}
