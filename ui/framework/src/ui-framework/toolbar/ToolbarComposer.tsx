/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";

import {
  CommonToolbarItem, ToolbarItemsManager, ToolbarUsage, ToolbarOrientation, ToolbarItemUtilities,
  GroupButton, ActionButton, ConditionalBooleanValue,
} from "@bentley/ui-abstract";
import { Orientation } from "@bentley/ui-core";
import { Logger } from "@bentley/bentleyjs-core";
import { Direction, ToolbarPanelAlignment, Toolbar } from "@bentley/ui-ninezone";
import { ToolbarHelper } from "./ToolbarHelper";
import { useDefaultToolbarItems } from "./useDefaultToolbarItems";
import { useUiItemsProviderToolbarItems } from "./useUiItemsProviderToolbarItems";
import { FrontstageManager, ToolActivatedEventArgs } from "../frontstage/FrontstageManager";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";

/** Private function to set up sync event monitoring of toolbar items */
function useToolbarItemSyncEffect(itemsManager: ToolbarItemsManager, syncIdsOfInterest: string[]) {
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

    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [itemsManager, syncIdsOfInterest, itemsManager.items]);

  React.useEffect(() => {
    const handleToolActivatedEvent = ({ toolId }: ToolActivatedEventArgs) => {
      itemsManager.setActiveToolId(toolId);
    };

    FrontstageManager.onToolActivatedEvent.addListener(handleToolActivatedEvent);

    return () => {
      FrontstageManager.onToolActivatedEvent.removeListener(handleToolActivatedEvent);
    };
  }, [itemsManager, itemsManager.items]);
}

function findPotentialParentGroup(items: readonly CommonToolbarItem[], itemId: string): CommonToolbarItem | undefined {
  for (const toolbarItem of items) {
    if (ToolbarItemUtilities.isGroupButton(toolbarItem)) {
      if (itemId === toolbarItem.id)
        return toolbarItem;

      const foundNestedGroup = findPotentialParentGroup(toolbarItem.items, itemId);
      if (foundNestedGroup)
        return foundNestedGroup;
    }
  }
  return undefined;
}

function cloneGroup(inGroup: GroupButton): GroupButton {
  const childItems: Array<ActionButton | GroupButton> = [];
  inGroup.items.forEach((item) => {
    if (ToolbarItemUtilities.isGroupButton(item))
      childItems.push(cloneGroup(item));
    else
      childItems.push(item);
  });

  const clonedGroup = { ...inGroup, items: childItems };
  return clonedGroup;
}

/** local function to combine items from Stage and from Plugins */
function combineItems(defaultItems: ReadonlyArray<CommonToolbarItem>, addonItems: ReadonlyArray<CommonToolbarItem>) {
  const items: CommonToolbarItem[] = [];
  const groupChildren: Array<ActionButton | GroupButton> = [];

  // istanbul ignore else
  if (defaultItems.length) {
    defaultItems.forEach((srcItem: CommonToolbarItem) => {
      // if the default item is a group that an addon may insert into copy it so we don't mess with original
      const toolbarItem = ToolbarItemUtilities.isGroupButton(srcItem) ? cloneGroup(srcItem) : srcItem;
      if (toolbarItem.parentToolGroupId && (ToolbarItemUtilities.isGroupButton(toolbarItem) || ToolbarItemUtilities.isActionButton(toolbarItem)))
        groupChildren.push(toolbarItem);
      else
        items.push(toolbarItem);
    });
  }
  // istanbul ignore else
  if (addonItems.length) {
    addonItems.forEach((srcItem: CommonToolbarItem) => {
      // if the default item is a group that an addon may insert into copy it so we don't mess with original
      const toolbarItem = ToolbarItemUtilities.isGroupButton(srcItem) ? cloneGroup(srcItem) : srcItem;
      if (toolbarItem.parentToolGroupId && (ToolbarItemUtilities.isGroupButton(toolbarItem) || ToolbarItemUtilities.isActionButton(toolbarItem)))
        groupChildren.push(toolbarItem);
      else
        items.push(toolbarItem);
    });
  }

  if (groupChildren.length) {
    groupChildren.forEach((toolbarItem: ActionButton | GroupButton) => {
      const parentGroup = findPotentialParentGroup(items, toolbarItem.parentToolGroupId!);
      // if parent group is located add item to it, if not just add to item list
      if (parentGroup && ToolbarItemUtilities.isGroupButton(parentGroup)) {
        parentGroup.items.push(toolbarItem);
      } else {
        Logger.logWarning("ToolbarComposer", `Requested Parent Group [${toolbarItem.parentToolGroupId!}] not found, so item [${toolbarItem.id}] is added directly to toolbar.`);
        items.push(toolbarItem);
      }
    });
  }
  return items;
}

/** Properties for the [[ToolbarComposer]] React components
 * @beta
 */
export interface ExtensibleToolbarProps {
  items: CommonToolbarItem[];
  usage: ToolbarUsage;
  /** Toolbar orientation. */
  orientation: ToolbarOrientation;
}

/**
 * Toolbar that is populated and maintained by item managers.
 * @beta
 */
export function ToolbarComposer(props: ExtensibleToolbarProps) {
  const { usage, orientation } = props;
  const [defaultItemsManager] = React.useState(() => new ToolbarItemsManager(props.items));
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      defaultItemsManager.items = props.items;
    }
  }, [props.items]); // eslint-disable-line react-hooks/exhaustive-deps

  // process default items
  const defaultItems = useDefaultToolbarItems(defaultItemsManager);
  const syncIdsOfInterest = React.useMemo(() => ToolbarItemsManager.getSyncIdsOfInterest(defaultItems), [defaultItems]);
  useToolbarItemSyncEffect(defaultItemsManager, syncIdsOfInterest);

  // process items from addon UI providers
  const [addonItemsManager] = React.useState(() => new ToolbarItemsManager());
  const addonItems = useUiItemsProviderToolbarItems(addonItemsManager, usage, orientation);
  const addonSyncIdsOfInterest = React.useMemo(() => ToolbarItemsManager.getSyncIdsOfInterest(addonItems), [addonItems]);
  useToolbarItemSyncEffect(addonItemsManager, addonSyncIdsOfInterest);

  const toolbarItems = React.useMemo(() => combineItems(defaultItems, addonItems), [defaultItems, addonItems]);

  const toolbarOrientation = orientation === ToolbarOrientation.Horizontal ? Orientation.Horizontal : Orientation.Vertical;
  const expandsTo = toolbarOrientation === Orientation.Horizontal ? Direction.Bottom : usage === ToolbarUsage.ViewNavigation ? Direction.Left : Direction.Right;
  const panelAlignment = (toolbarOrientation === Orientation.Horizontal && usage === ToolbarUsage.ViewNavigation) ? ToolbarPanelAlignment.End : ToolbarPanelAlignment.Start;

  const createReactNodes = (): React.ReactNode => {
    const availableItems = toolbarItems
      .filter((item) => !(ConditionalBooleanValue.getValue(item.isHidden)))
      .sort((a, b) => a.itemPriority - b.itemPriority);

    if (0 === availableItems.length)
      return null;

    const createdNodes = availableItems.map((item: CommonToolbarItem) => {
      return ToolbarHelper.createNodeForToolbarItem(item);
    });
    return createdNodes;
  };

  return <Toolbar
    expandsTo={expandsTo}
    panelAlignment={panelAlignment}
    items={
      <>
        {createReactNodes()}
      </>
    }
  />;

}
