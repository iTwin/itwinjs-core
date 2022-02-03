/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import type { ActionButton, GroupButton} from "@itwin/appui-abstract";
import { ConditionalBooleanValue, ConditionalStringValue, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { BadgeUtilities, IconHelper } from "@itwin/core-react";
import { BackArrow } from "./groupPanel/BackArrow";
import { GroupColumn } from "./groupPanel/Column";
import { Columns } from "./groupPanel/Columns";
import { Panel } from "./groupPanel/Panel";
import { Title } from "./groupPanel/Title";
import { GroupToolExpander } from "./groupPanel/tool/Expander";
import { GroupTool } from "./groupPanel/tool/Tool";
import { useToolbarPopupContext } from "./PopupItem";
import { useToolbarWithOverflowDirectionContext } from "./ToolbarWithOverflow";

function getNumItemsInColumn(numTotalItems: number): number {
  if (numTotalItems <= 6)
    return numTotalItems;
  if (numTotalItems <= 24)
    return Math.ceil(numTotalItems / 2);
  if (numTotalItems <= 36)
    return Math.ceil(numTotalItems / 3);
  return Math.ceil(numTotalItems / 4);
}

interface PopupItemsPanelProps {
  groupItem: GroupButton;
  activateOnPointerUp?: boolean;
}

/** Component that displays a list of tools in a panel.
 * @internal future
 */
export function PopupItemsPanel(props: PopupItemsPanelProps) {
  const [groupArray, setGroupArray] = React.useState([props.groupItem]);
  const activeGroup = React.useMemo(() => groupArray[0], [groupArray]);
  const items = React.useMemo(() => activeGroup.items, [activeGroup]);

  const preferredNumItemsInColumn = getNumItemsInColumn(items.length);

  // Divide items equally between columns.
  const numberOfColumns = Math.ceil(items.length / preferredNumItemsInColumn);
  const numItemsPerColumn = Math.ceil(items.length / numberOfColumns);

  const columnToItems = React.useMemo(() => items.reduce<ReadonlyArray<ReadonlyArray<GroupButton | ActionButton>>>((acc, item, index) => {
    const columnIndex = Math.floor(index / numItemsPerColumn);
    if (columnIndex >= acc.length) {
      return [
        ...acc,
        [item],
      ];
    }
    return [
      ...acc.slice(0, columnIndex),
      [
        ...acc[columnIndex],
        item,
      ],
      ...acc.slice(columnIndex + 1),
    ];
  }, []), [items, numItemsPerColumn]);

  const handleGroupItemClick = React.useCallback((item: GroupButton | ActionButton) => {
    // istanbul ignore else
    if (ToolbarItemUtilities.isGroupButton(item)) {
      // push group to front of array
      setGroupArray([item, ...groupArray]);
    }
  }, [groupArray]);

  const handleBackArrowClick = React.useCallback(() => {
    // istanbul ignore else
    if (groupArray.length > 1) {
      setGroupArray(groupArray.slice(1));
    }
  }, [groupArray]);

  const { closePanel, setSelectedItem } = useToolbarPopupContext();
  const { onItemExecuted, onKeyDown } = useToolbarWithOverflowDirectionContext();

  const handleOnPointerUp = React.useCallback(/* istanbul ignore next */(panelItem: GroupButton | ActionButton) => {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(panelItem)) {
      props.activateOnPointerUp && setSelectedItem && setSelectedItem(panelItem);
      props.activateOnPointerUp && panelItem.execute();
      onItemExecuted(panelItem);
      props.activateOnPointerUp && closePanel();
    }
  }, [props.activateOnPointerUp, setSelectedItem, closePanel, onItemExecuted]);

  const handleActionItemClick = React.useCallback((panelItem: GroupButton | ActionButton) => {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(panelItem)) {
      setSelectedItem && setSelectedItem(panelItem);
      panelItem.execute();
      onItemExecuted(panelItem);
      closePanel();
    }
  }, [setSelectedItem, closePanel, onItemExecuted]);

  // istanbul ignore next - NEEDSWORK add complete tests
  const handleOnKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    onKeyDown(e);
  }, [onKeyDown]);

  // build n-number of columns
  const columns = React.useMemo(() => columnToItems.map((columnItems, columnIndex) =>
    <GroupColumn key={columnIndex}>
      {columnItems.map((panelItem) => {
        const badge = BadgeUtilities.getComponentForBadgeType(panelItem.badgeType);
        const icon = IconHelper.getIconReactNode(panelItem.icon, panelItem.internalData);
        const label = ConditionalStringValue.getValue(panelItem.label);
        if (ToolbarItemUtilities.isGroupButton(panelItem)) {
          return (
            <GroupToolExpander
              isDisabled={ConditionalBooleanValue.getValue(panelItem.isDisabled)}
              key={panelItem.id}
              label={label}
              icon={icon}
              badge={badge}
              item={panelItem}
              onClick={handleGroupItemClick}
            />
          );
        }

        return (
          <GroupTool
            isDisabled={ConditionalBooleanValue.getValue(panelItem.isDisabled)}
            isActive={!!panelItem.isActive}
            key={panelItem.id}
            label={label}
            icon={icon}
            item={panelItem}
            onClick={handleActionItemClick}
            onPointerUp={handleOnPointerUp}
            badge={badge}
          />
        );
      })}
    </GroupColumn>), [columnToItems, handleActionItemClick, handleGroupItemClick, handleOnPointerUp]);

  // ensure we have a panel title for nested groups
  const titleString = activeGroup.panelLabel ? activeGroup.panelLabel : activeGroup.label;
  const panelTitle = React.useMemo(() => ConditionalStringValue.getValue(titleString), [titleString]);
  const className = classnames(
    1 === groupArray.length && "components-toolbar-item-expandable-group-group",
    groupArray.length > 1 && "components-toolbar-item-expandable-group-nested",
  );

  return (
    <Panel className={className} onKeyDown={handleOnKeyDown} >
      {groupArray.length > 1 &&
        <BackArrow
          className="components-back"
          onClick={handleBackArrowClick}
        />
      }
      {panelTitle &&
        <Title>
          {panelTitle}
        </Title>
      }
      {columns &&
        <Columns>
          {columns}
        </Columns>
      }
    </Panel>
  );
}
