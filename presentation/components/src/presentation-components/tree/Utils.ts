/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { StyleHelper } from "../common/StyleHelper";
import { CheckBoxState } from "@bentley/ui-core";
import { Node, PageOptions as PresentationPageOptions, LabelDefinition } from "@bentley/presentation-common";
import { DelayLoadedTreeNodeItem, PageOptions as UiPageOptions, ItemStyle, ItemColorOverrides } from "@bentley/ui-components";
import { createLabelRecord } from "../common/Utils";

/** @internal */
export const PRESENTATION_TREE_NODE_KEY = "__presentation-components/key";

/** @internal */
export const createTreeNodeItems = (nodes: ReadonlyArray<Readonly<Node>>, parentId?: string): DelayLoadedTreeNodeItem[] => {
  const list = new Array<DelayLoadedTreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId));
  return list;
};

/** @internal */
export const createTreeNodeItem = (node: Readonly<Node>, parentId?: string): DelayLoadedTreeNodeItem => {
  const item: DelayLoadedTreeNodeItem = {
    id: [...node.key.pathFromRoot].reverse().join("/"),
    label: node.label,
    labelDefinition: createLabelRecord(node.labelDefinition ? node.labelDefinition : LabelDefinition.fromLabelString(node.label), "node_label"),
  };
  (item as any)[PRESENTATION_TREE_NODE_KEY] = node.key;

  const style: ItemStyle = {};
  const colorOverrides: ItemColorOverrides = {};
  if (parentId)
    item.parentId = parentId;
  if (node.description)
    item.description = node.description;
  if (node.hasChildren)
    item.hasChildren = true;
  if (node.isExpanded)
    item.autoExpand = true;
  if (node.imageId)
    item.icon = node.imageId;
  if (StyleHelper.isBold(node))
    style.isBold = true;
  if (StyleHelper.isItalic(node))
    style.isItalic = true;
  const foreColor = StyleHelper.getForeColor(node);
  if (foreColor)
    colorOverrides.color = foreColor;
  const backColor = StyleHelper.getBackColor(node);
  if (backColor)
    colorOverrides.backgroundColor = backColor;
  if (node.isCheckboxVisible) {
    item.isCheckboxVisible = true;
    if (node.isChecked)
      item.checkBoxState = CheckBoxState.On;
    if (!node.isCheckboxEnabled)
      item.isCheckboxDisabled = true;
  }
  if (Object.keys(colorOverrides).length > 0)
    style.colorOverrides = colorOverrides;
  if (Object.keys(style).length > 0)
    item.style = style;
  if (node.extendedData)
    item.extendedData = node.extendedData;

  return item;
};

/** @internal */
export const pageOptionsUiToPresentation = (pageOptions?: UiPageOptions): PresentationPageOptions | undefined => {
  if (pageOptions)
    return { ...pageOptions };
  return undefined;
};
