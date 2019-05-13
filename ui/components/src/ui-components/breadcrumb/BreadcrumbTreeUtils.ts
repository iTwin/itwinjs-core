/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */
import { TreeNodeItem, ImmediatelyLoadedTreeNodeItem, DelayLoadedTreeNodeItem, TreeDataProvider, hasChildren } from "../tree/TreeDataProvider";
import { TableDataProvider, TableDataChangeEvent, RowItem, CellItem, ColumnDescription } from "../table/TableDataProvider";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { UiComponents } from "../UiComponents";

/**
 * Utility class for tree searching and manipulation in the Breadcrumb component.
 * @beta
 */
export class BreadcrumbTreeUtils {

  private static createIcon(node: TreeNodeItem): CellItem {
    return {
      key: "icon", record:
        new PropertyRecord(
          {
            value: hasChildren(node) ? "icon-folder" : node.icon,
            valueFormat: PropertyValueFormat.Primitive,
            displayValue: hasChildren(node) ? "icon-folder" : node.icon!,
          },
          {
            name: "icon",
            displayLabel: UiComponents.i18n.translate("UiComponents:breadcrumb.icon"),
            typename: "icon",
          }),
    };
  }

  private static createLabel(node: TreeNodeItem): CellItem {
    return {
      key: "label",
      record: new PropertyRecord(
        {
          value: node.label,
          valueFormat: PropertyValueFormat.Primitive,
          displayValue: node.label,
        },
        {
          name: "label",
          displayLabel: UiComponents.i18n.translate("UiComponents:breadcrumb.name"),
          typename: "text",
        }),
    };
  }

  private static createDescription(node: TreeNodeItem): CellItem {
    return {
      key: "description",
      record: new PropertyRecord(
        {
          value: node.description || "",
          valueFormat: PropertyValueFormat.Primitive,
          displayValue: node.description || "",
        },
        {
          name: "description",
          displayLabel: UiComponents.i18n.translate("UiComponents:breadcrumb.description"),
          typename: "text",
        }),
    };
  }

  /**
   * Transforms a list of children from a tree node into a [[TableDataProvider]], given a list of column descriptions.
   * @param nodes Node list to use as a basis for the [[TableDataProvider]].
   * @param columns An array of column descriptions to specify which columns to provide to the resulting [[TableDataProvider]].
   * @returns A [[TableDataProvider]] object that can be used to populate a Table component.
   */
  public static aliasNodeListToTableDataProvider = (nodes: TreeNodeItem[], columns: ColumnDescription[], treeDataProvider?: TreeDataProvider): TableDataProvider => {
    return {
      onColumnsChanged: new TableDataChangeEvent(),
      onRowsChanged: new TableDataChangeEvent(),
      getColumns: async () => columns,
      getRowsCount: async () => nodes.length,
      getRow: async (rowIndex: number, _unfiltered?: boolean): Promise<DataRowItem> => {
        if (rowIndex < 0 || rowIndex > nodes.length)
          return { _node: {} as TreeNodeItem, key: "", cells: [] };

        const node = nodes[rowIndex];

        const cells: CellItem[] = [
          BreadcrumbTreeUtils.createIcon(node),
          BreadcrumbTreeUtils.createLabel(node),
          BreadcrumbTreeUtils.createDescription(node),
        ];

        for (const key in node.extendedData) {
          // only add string values to table cell list
          if (node.extendedData.hasOwnProperty(key) && node.extendedData[key] instanceof PropertyRecord) {
            cells.push({
              key,
              record: node.extendedData[key],
              style: node.style,
            });
          } else if (node.extendedData.hasOwnProperty(key) && (typeof node.extendedData[key] === "string" || typeof node.extendedData[key] === "boolean" || typeof node.extendedData[key] === "number")) {
            cells.push({
              key,
              record: new PropertyRecord(
                {
                  value: node.extendedData[key].toString(),
                  valueFormat: PropertyValueFormat.Primitive,
                  displayValue: node.extendedData[key].toString(),
                },
                {
                  name: key,
                  displayLabel: key,
                  typename: "text",
                }),
              style: node.style,
            });
          }
        }
        node.extendedData = node.extendedData || {};
        node.extendedData.id = node.id;
        node.extendedData.label = node.label;
        node.extendedData.description = node.description;
        if ((node as DelayLoadedTreeNodeItem).hasChildren !== undefined)
          node.extendedData.hasChildren = (node as DelayLoadedTreeNodeItem).hasChildren;
        if ((node as ImmediatelyLoadedTreeNodeItem).children !== undefined)
          node.extendedData.children = (node as ImmediatelyLoadedTreeNodeItem).children;
        node.extendedData.dataProvider = treeDataProvider;
        node.extendedData.icon = node.icon;
        const row: DataRowItem = {
          _node: node,
          key: node.id,
          extendedData: node.extendedData,
          isDisabled: false,
          colorOverrides: node.style ? node.style.colorOverrides : undefined,
          cells,
        };
        return row;
      },
      // TODO: implement sorting function
      sort: /* istanbul ignore next */ async () => { },
    };
  }
}

/** @internal */
export interface DataRowItem extends RowItem {
  _node?: TreeNodeItem;
}
