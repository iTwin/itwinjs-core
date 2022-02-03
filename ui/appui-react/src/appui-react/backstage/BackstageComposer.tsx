/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import type { BackstageItem, UiSyncEventArgs } from "@itwin/appui-abstract";
import { BackstageItemsManager, ConditionalBooleanValue, isStageLauncher } from "@itwin/appui-abstract";
import type { CommonProps } from "@itwin/core-react";
import { BackstageSeparator, Backstage as NZ_Backstage } from "@itwin/appui-layout-react";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";
import { BackstageComposerItem } from "./BackstageComposerItem";
import { useBackstageManager, useIsBackstageOpen } from "./BackstageManager";
import { useDefaultBackstageItems } from "./useDefaultBackstageItems";
import { useUiItemsProviderBackstageItems } from "./useUiItemsProviderBackstageItems";

// cSpell:ignore safearea

/** Private function to set up sync event monitoring of backstage items */
function useBackstageItemSyncEffect(itemsManager: BackstageItemsManager, syncIdsOfInterest: string[]) {
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    const handleSyncUiEvent = (args: UiSyncEventArgs) => {
      if (0 === syncIdsOfInterest.length)
        return;

      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value.toLowerCase()))) {
        // process each item that has interest
        itemsManager.refreshAffectedItems(args.eventIds);
      }
    };

    if (isInitialMount.current) {
      isInitialMount.current = false;
      // initialize the display state of any items with syncIds/condition defined
      itemsManager.refreshAffectedItems(new Set(syncIdsOfInterest));
    }

    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [itemsManager, itemsManager.items, syncIdsOfInterest]);
}

/** local function to combine items from Stage and from Extensions */
function combineItems(stageItems: ReadonlyArray<BackstageItem>, addonItems: ReadonlyArray<BackstageItem>, hideSoloStageEntry: boolean) {
  let items: BackstageItem[] = [];
  if (stageItems.length) {
    // Walk through each and ensure no duplicate ids are added.
    stageItems.forEach((srcItem) => {
      if (-1 === items.findIndex((item) => item.id === srcItem.id)) {
        items.push(srcItem);
      }
    });
  }
  if (addonItems.length) {
    // Walk through each and ensure no duplicate ids are added.
    addonItems.forEach((srcItem) => {
      if (-1 === items.findIndex((item) => item.id === srcItem.id)) {
        items.push(srcItem);
      }
    });
  }

  if (hideSoloStageEntry) {
    // per user request don't show stage launcher if only one stage is available
    const numberOfFrontstageItems = items.reduce((accumulator, item) => accumulator + (isStageLauncher(item) ? 1 : 0), 0);
    if (1 === numberOfFrontstageItems)
      items = items.filter((item) => !isStageLauncher(item));
  }

  return items;
}

/** @internal */
export type GroupedItems = ReadonlyArray<ReadonlyArray<BackstageItem>>;

/** @internal */
export const useGroupedItems = (items: ReadonlyArray<BackstageItem>): GroupedItems => {
  return React.useMemo(() => {
    const grouped = items.reduce<GroupedItems>((acc, item) => {
      if (ConditionalBooleanValue.getValue(item.isHidden))
        return acc;
      const groupIndex = acc.findIndex((group) => group[0].groupPriority === item.groupPriority);
      if (groupIndex >= 0)
        return [
          ...acc.slice(0, groupIndex),
          [
            ...acc[groupIndex],
            item,
          ],
          ...acc.slice(groupIndex + 1),
        ];
      return [
        ...acc,
        [
          item,
        ],
      ];
    }, []);
    const sortedGroups = grouped.reduce<GroupedItems>((acc, group) => {
      const sortedGroup = [...group].sort((a, b) => a.itemPriority - b.itemPriority);
      return [
        ...acc,
        sortedGroup,
      ];
    }, []);
    return [...sortedGroups].sort((a, b) => a[0].groupPriority - b[0].groupPriority);
  }, [items]);
};

/** Props of [[BackstageComposer]] component.
 * @public
 */
export interface BackstageComposerProps extends CommonProps {
  /** React node for an optional header item */
  readonly header?: React.ReactNode;
  /** Indicates whether to place an overlay over the frontstage when the backstage is displayed */
  readonly showOverlay?: boolean;
  /** List of backstage items to show */
  readonly items: BackstageItem[];
  /** If true and only one stage launcher item is found, do not show entry in backstage */
  readonly hideSoloStageEntry?: boolean;
}

/** Backstage component composed from [[BackstageManager]] items.
 * @public
 */
export function BackstageComposer(props: BackstageComposerProps) {
  const [defaultItemsManager, setDefaultItemsManager] = React.useState(new BackstageItemsManager(props.items));
  const initialItems = React.useRef(props.items);

  React.useEffect(() => {
    if (initialItems.current !== props.items) {
      initialItems.current = props.items;
      setDefaultItemsManager(new BackstageItemsManager(props.items));
    }
  }, [props.items]);

  const manager = useBackstageManager();
  const isOpen = useIsBackstageOpen(manager);
  const safeAreaInsets = React.useContext(SafeAreaContext);
  const handleClose = React.useCallback(() => {
    manager.close();
  }, [manager]);

  const defaultItems = useDefaultBackstageItems(defaultItemsManager);
  const syncIdsOfInterest = React.useMemo(() => BackstageItemsManager.getSyncIdsOfInterest(defaultItems), [defaultItems]);
  useBackstageItemSyncEffect(defaultItemsManager, syncIdsOfInterest);

  const [addonItemsManager] = React.useState(new BackstageItemsManager());
  const addonItems = useUiItemsProviderBackstageItems(addonItemsManager);
  const addonSyncIdsOfInterest = React.useMemo(() => BackstageItemsManager.getSyncIdsOfInterest(addonItems), [addonItems]);
  useBackstageItemSyncEffect(addonItemsManager, addonSyncIdsOfInterest);

  const combinedBackstageItems = React.useMemo(() => combineItems(defaultItems, addonItems, !!props.hideSoloStageEntry), [defaultItems, addonItems, props.hideSoloStageEntry]);
  const groups = useGroupedItems(combinedBackstageItems);

  return (
    <NZ_Backstage
      className={props.className}
      header={props.header}
      isOpen={isOpen}
      onClose={handleClose}
      safeAreaInsets={safeAreaInsets}
      showOverlay={props.showOverlay}
      style={props.style}
    >
      {groups.map((group, groupIndex) => (
        group.map((item, itemIndex) => {
          const composerItem = (
            <BackstageComposerItem
              item={item}
              key={item.id}
            />
          );
          return itemIndex === 0 && groupIndex > 0 ? (
            <React.Fragment key={groupIndex}>
              <BackstageSeparator />
              {composerItem}
            </React.Fragment>
          ) : composerItem;
        })
      ))}
    </NZ_Backstage>
  );
}
