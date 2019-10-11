/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { CheckBoxState } from "@bentley/ui-core";
import { MutableTreeModelNode, TreeNodeItemData } from "../../../ui-components";
import { TreeNodeItem } from "../../../ui-components/tree/TreeDataProvider";

/** Returns random MutableTreeModelNode. */
export const createRandomMutableTreeModelNode = (parentNodeId?: string, selected?: boolean): MutableTreeModelNode => {
  const nodeId = faker.random.uuid();
  return {
    id: nodeId,
    description: faker.random.word(),
    isLoading: faker.random.boolean(),
    label: faker.random.word(),
    isExpanded: faker.random.boolean(),
    isSelected: selected !== undefined ? selected : faker.random.boolean(),
    checkbox: { state: CheckBoxState.Off, isVisible: faker.random.boolean(), isDisabled: faker.random.boolean() },
    depth: faker.random.number(),
    item: createRandomTreeNodeItem(nodeId, parentNodeId),
    parentId: parentNodeId,
    numChildren: faker.random.number(),
  };
};

/** Returns multiple random MutableTreeModelNode. */
export const createRandomMutableTreeModelNodes = (count?: number, parentId?: string): MutableTreeModelNode[] => {
  const nodes: MutableTreeModelNode[] = [];
  let nodesCount = count || faker.random.number({ min: 2, max: 10 });
  while (nodesCount--)
    nodes.push(createRandomMutableTreeModelNode(parentId));
  return nodes;
};

/** Returns multiple random TreeNodeItem. */
export const createRandomTreeNodeItems = (count?: number, parentId?: string, createChildren: boolean = true): TreeNodeItemData[] => {
  const items: TreeNodeItemData[] = [];
  let itemCount = count || faker.random.number({ min: 3, max: 9 });
  while (itemCount--) {
    const treeNodeItem = createRandomTreeNodeItem(parentId);
    if (itemCount % 2 === 0)
      items.push({ ...treeNodeItem, children: createChildren ? createRandomTreeNodeItems(undefined, treeNodeItem.id, false) : undefined });
    else
      items.push({ ...treeNodeItem, hasChildren: faker.random.boolean() });
  }

  return items;
};

/** Returns random TreeNodeItem */
export const createRandomTreeNodeItem = (itemId?: string, parentId?: string): TreeNodeItem => {
  return {
    id: itemId || faker.random.uuid(),
    label: faker.random.word(),
    autoExpand: faker.random.boolean(),
    description: faker.random.word(),
    icon: faker.random.word(),
    parentId,
  };
};
