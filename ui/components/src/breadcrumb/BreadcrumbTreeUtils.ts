/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */
import { TreeDataProvider, TreeNodeItem } from "../tree";
import { TableDataProvider, TableDataChangeEvent, RowItem, CellItem, ColumnDescription } from "../table";
import { PropertyRecord, PropertyValueFormat } from "..";

/**
 * Utility class for tree searching and manipulation in the Breadcrumb component.
 */
export class BreadcrumbTreeUtils {
  /**
   * Searches for target node and returns a list of target node, with all parent nodes.
   * Return list is ordered parent first, with root node first and target node as the last element.
   * @param dataProvider Tree data provider to search for target in.
   * @param target Target node to search for.
   * @returns Promise for a list of parent nodes up to and including target parameter.
   */
  public static pathTo = async (dataProvider: TreeDataProvider, target?: TreeNodeItem): Promise<TreeNodeItem[]> => {
    if (target === undefined)
      return [];
    const children = await dataProvider.getRootNodes({ size: 9999, start: 0 });
    for (const child of children) {
      const p = await BreadcrumbTreeUtils._path(dataProvider, target, child);
      if (p !== undefined) return p;
    }
    return [];
  }

  private static _path = async (dataProvider: TreeDataProvider, target: TreeNodeItem, tree: TreeNodeItem): Promise<TreeNodeItem[] | undefined> => {
    if (tree.id === target.id)
      return [tree];
    if (!tree.hasChildren)
      return undefined;
    const children = await dataProvider.getChildNodes(tree, { size: 9999, start: 0 });

    for (const child of children) {
      const p = await BreadcrumbTreeUtils._path(dataProvider, target, child);
      if (p) return [tree, ...p];
    }
    return undefined;
  }
  /**
   * Transforms a node list from [[BreadcrumbTreeUtils.pathTo]] into a string, composed of tree node labels separated by a given delimiter character.
   * @param pathList List of nodes to convert to delimited string.
   * @param delimiter String delimiter to insert between tree node labels.
   * @returns String of tree node labels separated by delimiter.
   */
  public static nodeListToString = (pathList: ReadonlyArray<Readonly<TreeNodeItem>>, delimiter: string): string => {
    const p: string[] = [];
    if (pathList.length === 0)
      return "";
    for (const item of pathList) {
      if (item && "label" in item)
        p.push(item.label);
    }
    return p.join(delimiter);
  }

  private static _escapeRegExp = (str: string) => str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");

  /**
   * Takes a string in the format of the return value of [[BreadcrumbTreeUtils.nodeListToString]], and finds the tree node
   * object in dataProvider based on the delimiter separating tree node labels.
   * @param dataProvider Tree data provider to search for target in.
   * @param pathString String path value generated from [[BreadcrumbTreeUtils.nodeListToString]] to be used to locate tree node.
   * @param delimiter String delimiter used in [[BreadcrumbTreeUtils.nodeListToString]], to distinguish each between each node.
   * @returns Tree node located by the pathString parameter.
   */
  public static findChild = async (dataProvider: TreeDataProvider, pathString: string, delimiter: string): Promise<TreeNodeItem | undefined> => {
    if (pathString.lastIndexOf(delimiter) === pathString.length - delimiter.length)
      pathString = pathString.substr(0, pathString.length - delimiter.length);
    if (pathString.length === 0)
      return undefined;
    const root = await dataProvider.getRootNodes({ size: 9999, start: 0 });
    for (const tree of root) {
      const node = await BreadcrumbTreeUtils._find(dataProvider, tree, pathString, delimiter);
      if (node)
        return node;
    }
    return undefined;
  }

  private static _find = async (dataProvider: TreeDataProvider, node: TreeNodeItem, p: string, delimiter: string): Promise<TreeNodeItem | undefined> => {
    // remove leading delimiter
    if (p.indexOf(delimiter) === 0)
      p = p.substr(delimiter.length);

    const { label } = node;
    if (label === p) {
      return node;
    }
    if (p.indexOf(label) === 0 && node.hasChildren) {
      const children = await dataProvider.getChildNodes(node, { size: 9999, start: 0 });
      for (const child of children) {
        const n = await BreadcrumbTreeUtils._find(dataProvider, child, p.substr(label.length), delimiter);
        if (n)
          return n;
      }
    }
    return undefined;
  }

  /**
   * Takes a string in the format of the return value of [[BreadcrumbTreeUtils.nodeListToString]], and returns a list of all
   * parent nodes in pathString, and a list of all child nodes matching the last substring delimited by delimiter parameter in pathString.
   * The .items field of the returned object contains all parent tree node objects up to last instance of the delimiter parameter in pathString.
   * The .list field of the returned object contains all tree nodes that are children of the last tree node in the .items field
   * that match the substring following the last instance of the delimiter parameter in pathString.
   * @param dataProvider Tree data provider to search for target in.
   * @param pathString String path value generated from [[BreadcrumbTreeUtils.nodeListToString]] to be used to locate tree nodes.
   * @param delimiter String delimiter used in [[BreadcrumbTreeUtils.nodeListToString]], to distinguish each between each node.
   * @param hasChildren Specifies whether to filter all items in .list, leaving only nodes with children.
   * @returns Object with a .items field: a list of all parent tree nodes and a .list field: all child nodes matching last substring delimited by
   * delimiter parameter in pathString.
   */
  public static findMatches = async (dataProvider: TreeDataProvider, pathString: string, delimiter: string, hasChildren: boolean = false): Promise<{ items: ReadonlyArray<Readonly<TreeNodeItem>>, list: ReadonlyArray<Readonly<TreeNodeItem>> }> => {
    let items: ReadonlyArray<Readonly<TreeNodeItem>> = [];
    let list: ReadonlyArray<Readonly<TreeNodeItem>> = [];
    if (pathString.length === 0) {
      items = await dataProvider.getRootNodes({ size: 9999, start: 0 });
      list = [];
    } else {
      const del = BreadcrumbTreeUtils._escapeRegExp(delimiter);
      const mat = pathString.match(new RegExp("(.*)" + del + "(.*?)$"));

      let node: TreeNodeItem | undefined;
      let name = pathString;
      if (mat) {
        node = await BreadcrumbTreeUtils.findChild(dataProvider, mat[1], delimiter);
        name = mat[2];
      }
      list = await BreadcrumbTreeUtils.pathTo(dataProvider, node);
      let children: ReadonlyArray<Readonly<TreeNodeItem>>;
      if (node === undefined)
        children = await dataProvider.getRootNodes({ size: 9999, start: 0 });
      else
        children = await dataProvider.getChildNodes(node, { size: 9999, start: 0 });
      if (name.length === 0) {
        items = children;
      } else {
        for (const tree of children) {
          if (tree.label.substr(0, name.length) === name) {
            items = [...items, tree];
          }
        }
      }
    }
    if (hasChildren)
      return { items: items.filter((child) => child.hasChildren), list };
    else
      return { items, list };
  }

  /**
   * Transforms a list of children from a tree node into a [[TableDataProvider]], given a list of column descriptions.
   * @param nodes Node list to use as a basis for the [[TableDataProvider]].
   * @param columns An array of column descriptions to specify which columns to provide to the resulting [[TableDataProvider]].
   * @returns A [[TableDataProvider]] object that can be used to populate a [[Table]] component.
   */
  public static aliasNodeListToTableDataProvider = (nodes: ReadonlyArray<Readonly<TreeNodeItem>>, columns: ColumnDescription[]): TableDataProvider => {
    return {
      onColumnsChanged: new TableDataChangeEvent(),
      onRowsChanged: new TableDataChangeEvent(),
      getColumns: async () => columns,
      getRowsCount: async () => nodes.length,
      getRow: async (rowIndex: number, unfiltered?: boolean): Promise<DataRowItem> => {
        if (rowIndex > nodes.length || (unfiltered && !unfiltered)) return { _node: {} as TreeNodeItem, key: "", cells: [] };
        const n = nodes[rowIndex];
        if (!n) return { _node: {} as TreeNodeItem, key: "", cells: [] };
        const colorOverrides = {
          foreColor: n.labelForeColor,
          backColor: n.labelBackColor,
        };
        const cells: CellItem[] = [
          {
            key: "icon", record:
              new PropertyRecord(
                {
                  value: n.hasChildren ? "icon-folder" : n.iconPath!,
                  valueFormat: PropertyValueFormat.Primitive,
                  displayValue: n.hasChildren ? "icon-folder" : n.iconPath!,
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
                value: n.description,
                valueFormat: PropertyValueFormat.Primitive,
                displayValue: n.description,
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
      sort: async () => { },
    };
  }
}

/** @hidden */
export interface DataRowItem extends RowItem {
  _node?: TreeNodeItem;
}
