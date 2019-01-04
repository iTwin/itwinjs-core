/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import StyleHelper from "../common/StyleHelper";
import { CheckBoxState } from "@bentley/ui-core";
import { Node, PageOptions as PresentationPageOptions } from "@bentley/presentation-common";
import { DelayLoadedTreeNodeItem, PageOptions as UiPageOptions } from "@bentley/ui-components";

/** @hidden */
export const createTreeNodeItems = (nodes: ReadonlyArray<Readonly<Node>>, parentId?: string): DelayLoadedTreeNodeItem[] => {
  const list = new Array<DelayLoadedTreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId));
  return list;
};

/** @hidden */
export const createTreeNodeItem = (node: Readonly<Node>, parentId?: string): DelayLoadedTreeNodeItem => {
  const item: DelayLoadedTreeNodeItem = {
    id: [...node.key.pathFromRoot].reverse().join("/"),
    label: node.label,
    description: node.description,
    hasChildren: node.hasChildren,
    labelForeColor: StyleHelper.getForeColor(node),
    labelBackColor: StyleHelper.getBackColor(node),
    labelBold: StyleHelper.isBold(node),
    labelItalic: StyleHelper.isItalic(node),
    isCheckboxVisible: node.isCheckboxVisible,
    isCheckboxDisabled: (node.isCheckboxEnabled !== true),
    checkBoxState: node.isChecked ? CheckBoxState.On : CheckBoxState.Off,
    parentId,
    extendedData: { key: node.key },
  };
  return item;
};

/** @hidden */
export const pageOptionsUiToPresentation = (pageOptions?: UiPageOptions): PresentationPageOptions | undefined => {
  if (pageOptions)
    return { ...pageOptions };
  return undefined;
};
