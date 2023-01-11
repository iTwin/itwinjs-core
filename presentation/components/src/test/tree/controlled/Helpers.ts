/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PropertyRecord } from "@itwin/appui-abstract";
import { TreeModelNode, TreeNodeItem } from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { createRandomECInstancesNodeKey } from "@itwin/presentation-common/lib/cjs/test";
import { PresentationTreeNodeItem } from "../../../presentation-components";

export function createTreeNodeItem(item?: Partial<PresentationTreeNodeItem>): PresentationTreeNodeItem {
  return {
    id: item?.id ?? "node_id",
    key: item?.key ?? createRandomECInstancesNodeKey(),
    label: item?.label ?? PropertyRecord.fromString("Node Label"),
    ...item,
  };
}

export function createTreeModelNode(node?: Partial<TreeModelNode>, nodeItem?: TreeNodeItem): TreeModelNode {
  const label = nodeItem?.label ?? node?.label ?? PropertyRecord.fromString("TestLabel");
  return {
    id: node?.id ?? "0",
    parentId: node?.parentId,
    numChildren: node?.numChildren ?? 0,
    depth: node?.depth ?? 0,
    isExpanded: node?.isExpanded ?? false,
    isSelected: node?.isSelected ?? false,
    description: node?.description ?? "Node Description",
    checkbox: node?.checkbox ?? {
      isDisabled: false,
      isVisible: true,
      state: CheckBoxState.Off,
    },
    label,
    item: nodeItem ?? createTreeNodeItem({ label }),
  };
}
