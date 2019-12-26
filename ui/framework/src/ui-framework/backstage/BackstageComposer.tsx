/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { BackstageItem, BackstageItemsManager } from "@bentley/ui-abstract";
import { Backstage as NZ_Backstage, BackstageSeparator } from "@bentley/ui-ninezone";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { useBackstageItems } from "./useBackstageItems";
import { useBackstageManager, useIsBackstageOpen } from "./BackstageManager";
import { BackstageComposerItem } from "./BackstageComposerItem";

// cSpell:ignore safearea

/** @internal */
export type GroupedItems = ReadonlyArray<ReadonlyArray<BackstageItem>>;

/** @internal */
export const useGroupedItems = (manager: BackstageItemsManager): GroupedItems => {
  const items = useBackstageItems(manager);
  return React.useMemo(() => {
    const grouped = items.reduce<GroupedItems>((acc, item) => {
      if (!item.isVisible)
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
 * @beta
 */
export interface BackstageComposerProps extends CommonProps {
  readonly header?: React.ReactNode;
  readonly showOverlay?: boolean;
}

/** Backstage component composed from [[BackstageManager]] items.
 * @beta
 */
export function BackstageComposer(props: BackstageComposerProps) {
  const manager = useBackstageManager();
  const isOpen = useIsBackstageOpen(manager);
  const groups = useGroupedItems(manager.itemsManager);
  const safeAreaInsets = React.useContext(SafeAreaContext);
  const handleClose = React.useCallback(() => {
    manager.close();
  }, [manager]);

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
