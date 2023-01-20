/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { PropertyRecord } from "@itwin/appui-abstract";
import { DelayLoadedTreeNodeItem, ItemColorOverrides, ItemStyle, PageOptions as UiPageOptions } from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { LabelDefinition, Node, NodeKey, PartialNode, PageOptions as PresentationPageOptions } from "@itwin/presentation-common";
import { StyleHelper } from "../common/StyleHelper";
import { createLabelRecord } from "../common/Utils";
import { PresentationTreeNodeItem } from "./PresentationTreeNodeItem";

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
): PresentationTreeNodeItem[] {
  const list = new Array<PresentationTreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId, props));
  return list;
}

/** @internal */
export function createTreeNodeItem(
  node: Readonly<Node>,
  parentId?: string,
  props?: CreateTreeNodeItemProps,
): PresentationTreeNodeItem {
  const item: PresentationTreeNodeItem = {
    id: createTreeNodeId(node.key),
    label: createNodeLabelRecord(node, !!props?.appendChildrenCountForGroupingNodes),
    key: node.key,
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
): Partial<PresentationTreeNodeItem> {
  const item: Partial<PresentationTreeNodeItem> = {};
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
  item: Partial<PresentationTreeNodeItem>,
  node: Partial<Node>,
  parentId?: string,
): void {
  if (node.key !== undefined) {
    item.key = node.key;
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
 * @deprecated in 3.x.
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
