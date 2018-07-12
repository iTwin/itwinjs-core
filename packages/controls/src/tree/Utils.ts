/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Hierarchies */

import StyleHelper from "../common/StyleHelper";
import { CheckBoxState } from "@bentley/ui-core/lib/enums/CheckBoxState";
import { Node } from "@bentley/ecpresentation-common";
import { TreeNodeItem } from "@bentley/ui-components/lib/tree/TreeDataProvider";
import { PageOptions as PresentationPageOptions } from "@bentley/ecpresentation-common";
import { PageOptions as UiPageOptions } from "@bentley/ui-components/lib/common/PageOptions";

export const createTreeNodeItems = (nodes: ReadonlyArray<Readonly<Node>>, parentId?: string): TreeNodeItem[] => {
  const list = new Array<TreeNodeItem>();
  for (const node of nodes)
    list.push(createTreeNodeItem(node, parentId));
  return list;
};

export const createTreeNodeItem = (node: Readonly<Node>, parentId?: string): TreeNodeItem => {
  const item: TreeNodeItem = {
    id: [...node.key.pathFromRoot].reverse().join("/"),
    label: node.label,
    description: node.description || "",
    hasChildren: node.hasChildren || false,
    labelForeColor: StyleHelper.getForeColor(node),
    labelBackColor: StyleHelper.getBackColor(node),
    labelBold: StyleHelper.isBold(node),
    labelItalic: StyleHelper.isItalic(node),
    displayCheckBox: node.isCheckboxVisible || false,
    checkBoxState: node.isChecked ? CheckBoxState.On : CheckBoxState.Off,
    isCheckBoxEnabled: node.isCheckboxEnabled || false,
    parentId,
    extendedData: { key: node.key },
  };
  return item;
};

export const pageOptionsUiToPresentation = (pageOptions?: UiPageOptions): PresentationPageOptions | undefined => {
  if (pageOptions)
    return { pageSize: pageOptions.size, pageStart: pageOptions.start };
  return undefined;
};
