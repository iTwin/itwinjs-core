/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { PropertyRecord } from "@itwin/appui-abstract";
import { CheckBoxState } from "@itwin/core-react";
import type { MutableTreeModelNode, TreeNodeItemData } from "../../../components-react";
import type { TreeNodeItem } from "../../../components-react/tree/TreeDataProvider";

/** Returns random MutableTreeModelNode. */
export const createRandomMutableTreeModelNode = (parentNodeId?: string, selected?: boolean, label?: string): MutableTreeModelNode => {
  const nodeId = faker.random.uuid();
  const labelRecord = PropertyRecord.fromString(label ?? faker.random.word(), "label");
  return {
    id: nodeId,
    description: faker.random.word(),
    isLoading: faker.random.boolean(),
    label: labelRecord,
    isExpanded: faker.random.boolean(),
    isSelected: selected !== undefined ? selected : faker.random.boolean(),
    checkbox: { state: CheckBoxState.Off, isVisible: faker.random.boolean(), isDisabled: faker.random.boolean() },
    depth: faker.random.number(),
    item: createRandomTreeNodeItem(nodeId, parentNodeId, labelRecord),
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
    const treeNodeItem = createRandomTreeNodeItem(undefined, parentId);
    if (itemCount % 2 === 0)
      items.push({ ...treeNodeItem, children: createChildren ? createRandomTreeNodeItems(undefined, treeNodeItem.id, false) : undefined });
    else
      items.push({ ...treeNodeItem, hasChildren: faker.random.boolean() });
  }

  return items;
};

/** Returns random TreeNodeItem */
export const createRandomTreeNodeItem = (itemId?: string, parentId?: string, label?: PropertyRecord | string): TreeNodeItem => {
  return {
    id: itemId || faker.random.uuid(),
    label: label ? (label instanceof PropertyRecord) ? label : PropertyRecord.fromString(label, "label") : PropertyRecord.fromString(faker.random.word(), "label"),
    autoExpand: faker.random.boolean(),
    description: faker.random.word(),
    icon: faker.random.word(),
    parentId,
  };
};
