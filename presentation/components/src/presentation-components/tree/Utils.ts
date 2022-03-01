/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { LabelDefinition, Node, NodeKey, PartialNode, PageOptions as PresentationPageOptions } from "@itwin/presentation-common";
import { PropertyRecord } from "@itwin/appui-abstract";
import { DelayLoadedTreeNodeItem, ItemColorOverrides, ItemStyle, PageOptions as UiPageOptions } from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { StyleHelper } from "../common/StyleHelper";
import { createLabelRecord } from "../common/Utils";

/** @internal */
export const PRESENTATION_TREE_NODE_KEY = "__presentation-components/key";

/** @internal */
export interface CreateTreeNodeItemProps {
  appendChildrenCountForGroupingNodes?: boolean;
  customizeTreeNodeItem?: (item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) => void;
}

/** @internal */
export function createTreeNodeItems(
  nodes: ReadonlyArray<Readonly<Node>>,
  parentId?: string,
  props?: CreateTreeNodeItemProps,
): DelayLoadedTreeNodeItem[] {
  const list = new Array<DelayLoadedTreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId, props));
  return list;
}

/** @internal */
export function createTreeNodeItem(
  node: Readonly<Node>,
  parentId?: string,
  props?: CreateTreeNodeItemProps,
): DelayLoadedTreeNodeItem {
  const item: DelayLoadedTreeNodeItem = {
    id: createTreeNodeId(node.key),
    label: createNodeLabelRecord(node, !!props?.appendChildrenCountForGroupingNodes),
  };
  assignOptionalTreeNodeItemFields(item, node, parentId);
  const customizeItemCallback = props?.customizeTreeNodeItem ?? customizeTreeNodeItem; // eslint-disable-line deprecation/deprecation
  customizeItemCallback(item, node);
  return item;
}

/** @internal */
export function createPartialTreeNodeItem(
  node: PartialNode,
  parentId: string | undefined,
  props: CreateTreeNodeItemProps,
): Partial<DelayLoadedTreeNodeItem> {
  const item: Partial<DelayLoadedTreeNodeItem> = {};
  if (node.key !== undefined) {
    item.id = createTreeNodeId(node.key);
    item.label = createNodeLabelRecord(node, !!props.appendChildrenCountForGroupingNodes);
  }

  assignOptionalTreeNodeItemFields(item, node, parentId);
  const customizeItemCallback = props.customizeTreeNodeItem ?? customizeTreeNodeItem; // eslint-disable-line deprecation/deprecation
  customizeItemCallback(item, node);
  return item;
}

/** @internal */
export function createTreeNodeId(key: NodeKey): string {
  return [...key.pathFromRoot].reverse().join("/");
}

function assignOptionalTreeNodeItemFields(
  item: Partial<DelayLoadedTreeNodeItem>,
  node: Partial<Node>,
  parentId?: string,
): void {
  if (node.key !== undefined) {
    (item as any)[PRESENTATION_TREE_NODE_KEY] = node.key;
  }

  if (parentId) {
    item.parentId = parentId;
  }

  if (node.description) {
    item.description = node.description;
  }

  if (node.hasChildren) {
    item.hasChildren = true;
  }

  if (node.isExpanded) {
    item.autoExpand = true;
  }

  if (node.extendedData) {
    item.extendedData = node.extendedData;
  }
}

/**
 * Applies customization from [[Node]] to [[TreeNodeItem]].
 * @public
 * @deprecated
 */
export function customizeTreeNodeItem(item: Partial<DelayLoadedTreeNodeItem>, node: Partial<Node>) {
  if (node.imageId) { // eslint-disable-line deprecation/deprecation
    item.icon = node.imageId; // eslint-disable-line deprecation/deprecation
  }

  if (node.isCheckboxVisible) { // eslint-disable-line deprecation/deprecation
    item.isCheckboxVisible = true;
    if (node.isChecked) { // eslint-disable-line deprecation/deprecation
      item.checkBoxState = CheckBoxState.On;
    }

    if (!node.isCheckboxEnabled) { // eslint-disable-line deprecation/deprecation
      item.isCheckboxDisabled = true;
    }
  }

  const style = createTreeNodeItemStyle(node);
  if (Object.keys(style).length > 0) {
    item.style = style;
  }
}

function createTreeNodeItemStyle(node: Partial<Node>): ItemStyle {
  const style: ItemStyle = {};
  if (StyleHelper.isBold(node)) {
    style.isBold = true;
  }

  if (StyleHelper.isItalic(node)) {
    style.isItalic = true;
  }

  const colorOverrides: ItemColorOverrides = {};
  const foreColor = StyleHelper.getForeColor(node);
  if (foreColor) {
    colorOverrides.color = foreColor;
  }

  const backColor = StyleHelper.getBackColor(node);
  if (backColor) {
    colorOverrides.backgroundColor = backColor;
  }

  if (Object.keys(colorOverrides).length > 0) {
    style.colorOverrides = colorOverrides;
  }

  return style;
}

/** @internal */
export function pageOptionsUiToPresentation(pageOptions?: UiPageOptions): PresentationPageOptions | undefined {
  if (pageOptions)
    return { ...pageOptions };
  return undefined;
}

function createNodeLabelRecord(node: Node, appendChildrenCountForGroupingNodes: boolean): PropertyRecord {
  let labelDefinition = node.label;
  if (appendChildrenCountForGroupingNodes && NodeKey.isGroupingNodeKey(node.key)) {
    const countDefinition: LabelDefinition = {
      displayValue: `(${node.key.groupedInstancesCount})`,
      rawValue: `(${node.key.groupedInstancesCount})`,
      typeName: "string",
    };
    labelDefinition = {
      displayValue: `${labelDefinition.displayValue} ${countDefinition.displayValue}`,
      rawValue: {
        separator: " ",
        values: [
          labelDefinition,
          countDefinition,
        ],
      },
      typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME,
    };
  }
  return createLabelRecord(labelDefinition, "node_label");
}
