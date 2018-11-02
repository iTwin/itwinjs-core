/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */
import { TreeNodeItem, ImmediatelyLoadedTreeNodeItem, DelayLoadedTreeNodeItem } from "../tree";
import { TableDataProvider, TableDataChangeEvent, RowItem, CellItem, ColumnDescription } from "../table";
import { PropertyRecord, PropertyValueFormat } from "..";

/**
 * Utility class for tree searching and manipulation in the Breadcrumb component.
 */
export class BreadcrumbTreeUtils {
  /**
   * Determines whether node has children
   * @param node node to check
   * @returns whether node has children
   */
  public static hasChildren = (node: TreeNodeItem) => {
    const nodeAsImmediate = node as ImmediatelyLoadedTreeNodeItem;
    if ("children" in nodeAsImmediate && nodeAsImmediate.children && nodeAsImmediate.children.length > 0)
      return true;
    const nodeAsDelayed = node as DelayLoadedTreeNodeItem;
    if ("hasChildren" in nodeAsDelayed && nodeAsDelayed.hasChildren)
      return true;
    return false;
  }

  /**
   * Transforms a list of children from a tree node into a [[TableDataProvider]], given a list of column descriptions.
   * @param nodes Node list to use as a basis for the [[TableDataProvider]].
   * @param columns An array of column descriptions to specify which columns to provide to the resulting [[TableDataProvider]].
   * @returns A [[TableDataProvider]] object that can be used to populate a [[Table]] component.
   */
  public static aliasNodeListToTableDataProvider = (nodes: TreeNodeItem[], columns: ColumnDescription[]): TableDataProvider => {
    return {
      onColumnsChanged: new TableDataChangeEvent(),
      onRowsChanged: new TableDataChangeEvent(),
      getColumns: async () => columns,
      getRowsCount: async () => nodes.length,
      getRow: async (rowIndex: number, _unfiltered?: boolean): Promise<DataRowItem> => {
        if (rowIndex > nodes.length) return { _node: {} as DelayLoadedTreeNodeItem, key: "", cells: [] };
        const n = nodes[rowIndex];
        if (!n) return { _node: {} as DelayLoadedTreeNodeItem, key: "", cells: [] };
        const colorOverrides = {
          foreColor: n.labelForeColor,
          backColor: n.labelBackColor,
        };
        const cells: CellItem[] = [
          {
            key: "icon", record:
              new PropertyRecord(
                {
                  value: BreadcrumbTreeUtils.hasChildren(n) ? "icon-folder" : n.icon,
                  valueFormat: PropertyValueFormat.Primitive,
                  displayValue: BreadcrumbTreeUtils.hasChildren(n) ? "icon-folder" : n.icon!,
                },
                {
                  name: "icon",
                  displayLabel: "icon",
                  typename: "icon",
                }),
          },
          {
            key: "label",
            record: new PropertyRecord(
              {
                value: n.label,
                valueFormat: PropertyValueFormat.Primitive,
                displayValue: n.label,
              },
              {
                name: "label",
                displayLabel: "label",
                typename: "text",
              }),
          },
          {
            key: "description",
            record: new PropertyRecord(
              {
                value: n.description || "",
                valueFormat: PropertyValueFormat.Primitive,
                displayValue: n.description || "",
              },
              {
                name: "description",
                displayLabel: "description",
                typename: "text",
              }),
          },
        ];
        for (const k in n.extendedData) {
          // only add string values to table cell list
          if (n.extendedData.hasOwnProperty(k) && typeof n.extendedData[k] === "string") {
            cells.push({
              key: k,
              record: n.extendedData[k],
              isBold: n.labelBold,
              isItalic: n.labelItalic,
              colorOverrides,
            });
          }
        }
        n.extendedData = n.extendedData || {};
        n.extendedData.label = n.label;
        n.extendedData.description = n.description;
        n.extendedData.icon = n.icon;
        const row: DataRowItem = {
          _node: n,
          key: n.id,
          extendedData: n.extendedData,
          isDisabled: false,
          colorOverrides: {
            foreColor: n.labelForeColor,
            backColor: n.labelBackColor,
          },
          cells,
        };
        return row;
      },
      // TODO: implement sorting function
      sort: async () => { },
    };
  }
}

/** @hidden */
export interface DataRowItem extends RowItem {
  _node?: DelayLoadedTreeNodeItem;
}
