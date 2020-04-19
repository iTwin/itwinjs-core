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
import { ToolbarWithOverflow } from "@bentley/ui-components";
import { Logger } from "@bentley/bentleyjs-core";
import { Direction, ToolbarPanelAlignment, Toolbar } from "@bentley/ui-ninezone";
import { ToolbarHelper } from "./ToolbarHelper";
import { useDefaultToolbarItems } from "./useDefaultToolbarItems";
import { useUiItemsProviderToolbarItems } from "./useUiItemsProviderToolbarItems";
import { FrontstageManager, ToolActivatedEventArgs } from "../frontstage/FrontstageManager";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { ToolbarDragInteractionContext } from "./DragInteraction";
import { UiFramework, UiVisibilityEventArgs } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";

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

function nestedAddItemToSpecifiedParentGroup(items: ReadonlyArray<ActionButton | GroupButton>, groupChildren: Array<ActionButton | GroupButton>): Array<ActionButton | GroupButton> {
  const outItems: Array<ActionButton | GroupButton> = [];
  for (const toolbarItem of items) {
    if (!ToolbarItemUtilities.isGroupButton(toolbarItem)) {
      outItems.push(toolbarItem);
      continue;
    }

    const newChildren: Array<ActionButton | GroupButton> = nestedAddItemToSpecifiedParentGroup(toolbarItem.items, groupChildren);
    const foundIndices: number[] = [];

    groupChildren.forEach((entry, index) => {
      if (entry.parentToolGroupId === toolbarItem.id) {
        foundIndices.push(index);
      }
    });

    if (foundIndices.length) {
      // process in reverse order so groupChildren can be reduced as we find matches
      foundIndices.sort((a, b) => a - b).reverse().forEach((foundIndex) => {
        newChildren.push(groupChildren[foundIndex]);
        groupChildren.splice(foundIndex);
      });
    }

    outItems.push({ ...toolbarItem, items: newChildren });
  }
  return outItems;
}

function addItemToSpecifiedParentGroup(items: readonly CommonToolbarItem[], groupChildren: Array<ActionButton | GroupButton>): CommonToolbarItem[] {
  const outItems: CommonToolbarItem[] = [];
  for (const toolbarItem of items) {
    if (!ToolbarItemUtilities.isGroupButton(toolbarItem)) {
      outItems.push(toolbarItem);
      continue;
    }

    const newChildren: Array<ActionButton | GroupButton> = nestedAddItemToSpecifiedParentGroup(toolbarItem.items, groupChildren);
    const foundIndices: number[] = [];

    groupChildren.forEach((entry, index) => {
      if (entry.parentToolGroupId === toolbarItem.id) {
        foundIndices.push(index);
      }
    });

    // istanbul ignore else
    if (foundIndices.length) {
      // process in reverse order so groupChildren can be reduced as we find matches
      foundIndices.sort((a, b) => a - b).reverse().forEach((foundIndex) => {
        newChildren.push(groupChildren[foundIndex]);
        groupChildren.splice(foundIndex);
      });
    }

    outItems.push({ ...toolbarItem, items: newChildren });
  }
  return outItems;
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

function getSortedChildren(group: GroupButton): ReadonlyArray<ActionButton | GroupButton> {
  const sortedChildren = group.items
    .filter((item) => !(ConditionalBooleanValue.getValue(item.isHidden)))
    .sort((a, b) => a.itemPriority - b.itemPriority)
    .map((i) => {
      if (ToolbarItemUtilities.isGroupButton(i)) {
        return { ...i, items: getSortedChildren(i) };
      }
      return i;
    });
  return sortedChildren;
}

/** local function to combine items from Stage and from Plugins */
function combineItems(defaultItems: ReadonlyArray<CommonToolbarItem>, addonItems: ReadonlyArray<CommonToolbarItem>) {
  let items: CommonToolbarItem[] = [];
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

  // if an item from an addon has specified a parent group then try to find it and insert it.  If no parent is found, add item at root level.
  if (groupChildren.length) {
    items = addItemToSpecifiedParentGroup(items, groupChildren);

    if (groupChildren.length) {
      groupChildren.forEach((toolbarItem: ActionButton | GroupButton) => {
        Logger.logWarning("ToolbarComposer", `Requested Parent Group [${toolbarItem.parentToolGroupId!}] not found, so item [${toolbarItem.id}] is added directly to toolbar.`);
        items.push(toolbarItem);
      });
    }
  }

  const availableItems = items
    .filter((item) => !(ConditionalBooleanValue.getValue(item.isHidden)))
    .sort((a, b) => a.itemPriority - b.itemPriority)
    .map((i) => {
      if (ToolbarItemUtilities.isGroupButton(i)) {
        return { ...i, items: getSortedChildren(i) };
      }
      return i;
    });

  return availableItems;
}

const useProximityOpacitySetting = () => {
  const [proximityOpacity, setProximityOpacity] = React.useState(UiShowHideManager.useProximityOpacity);
  React.useEffect(() => {
    const handleUiVisibilityChanged = (_args: UiVisibilityEventArgs) => {
      setProximityOpacity(UiShowHideManager.useProximityOpacity);
    };
    UiFramework.onUiVisibilityChanged.addListener(handleUiVisibilityChanged);
    return () => {
      UiFramework.onUiVisibilityChanged.removeListener(handleUiVisibilityChanged);
    };
  }, []);
  return proximityOpacity;
};

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
  const version = useFrameworkVersion();
  const isDragEnabled = React.useContext(ToolbarDragInteractionContext);
  const useProximityOpacity = useProximityOpacitySetting();

  if ("1" === version) {
    const createReactNodes = (): React.ReactNode => {
      const availableItems = toolbarItems;
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

  return <ToolbarWithOverflow
    expandsTo={expandsTo}
    panelAlignment={panelAlignment}
    items={toolbarItems}
    useDragInteraction={isDragEnabled}
    useProximityOpacity={useProximityOpacity && !UiFramework.isMobile()}
  />;

}
