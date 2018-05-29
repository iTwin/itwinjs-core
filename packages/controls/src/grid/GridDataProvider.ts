/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as _ from "lodash";
import { assert } from "@bentley/bentleyjs-core";
import { SortDirection } from "@bentley/ui-core";
import { ColumnDescription, RowItem, CellItem } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationError, ECPresentationStatus } from "@bentley/ecpresentation-common";
import * as content from "@bentley/ecpresentation-common/lib/content";
import ContentDataProvider, { CacheInvalidationProps } from "../common/ContentDataProvider";
import ContentBuilder from "../common/ContentBuilder";
import PageContainer from "../common/PageContainer";

export default class GridDataProvider extends ContentDataProvider {
  private _sortColumnKey: string | undefined;
  private _sortDirection: SortDirection = SortDirection.Ascending;
  private _filterExpression: string | undefined;
  private _pages: PageContainer<RowItem>;

  /** Constructor. */
  constructor(connection: IModelConnection, rulesetId: string, pageSize: number = 20, cachedPagesCount: number = 5) {
    super(connection, rulesetId, content.DefaultContentDisplayTypes.GRID);
    this._pages = new PageContainer(pageSize, cachedPagesCount);
  }

  protected invalidateCache(props: CacheInvalidationProps): void {
    if (props.descriptor) {
      this._filterExpression = undefined;
      this._sortColumnKey = undefined;
      this._sortDirection = SortDirection.Ascending;
      if (this.getColumns)
        this.getColumns.cache.clear();
    }

    if (props.size && this.getRowsCount)
      this.getRowsCount.cache.clear();

    if (props.content && this.getRow)
      this.getRow.cache.clear();

    if ((props.size || props.content) && this._pages)
      this._pages.invalidatePages();

    super.invalidateCache(props);
  }

  /** Handles filtering and sorting. */
  protected configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    const configured = super.configureContentDescriptor(descriptor);
    if (this._sortColumnKey) {
      const sortingField = descriptor.getFieldByName(this._sortColumnKey);
      if (sortingField) {
        configured.sortingField = sortingField;
        configured.sortDirection = (this._sortDirection === SortDirection.Ascending ? content.SortDirection.Ascending : content.SortDirection.Descending);
      }
    }
    configured.filterExpression = this._filterExpression;
    return configured;
  }

  /**
   * Sorts the data in this data provider.
   * @param columnIndex Index of the column to sort on.
   * @param sortDirection Sorting direction.
   */
  public async sort(columnIndex: number, sortDirection: SortDirection): Promise<void> {
    const columns = await this.getColumns();
    const sortingColumn = columns[columnIndex];
    if (!sortingColumn)
      throw new ECPresentationError(ECPresentationStatus.InvalidArgument, "Invalid column index");
    this._sortColumnKey = sortingColumn.key;
    this._sortDirection = sortDirection;
    this.invalidateCache({ content: true });
  }

  /** Returns column definitions for the content. */
  public getColumns = _.memoize(async (): Promise<Array<Readonly<ColumnDescription>>> => {
    const descriptor = await this.getContentDescriptor();
    return createColumns(descriptor);
  });

  /** Get the total number of rows in the content. */
  public getRowsCount = _.memoize(async (): Promise<number> => {
    return await this.getContentSetSize();
  });

  /**
   * Get a single row.
   * @param rowIndex Index of the row to return.
   */
  public getRow = _.memoize(async (rowIndex: number): Promise<Readonly<RowItem>> => {
    let page = this._pages.getPage(rowIndex);
    if (!page) {
      page = this._pages.reservePage(rowIndex);
      page.items = createRows(await this.getContent({
        pageStart: page.position.start,
        pageSize: page.position.end - page.position.start,
      }));
    }
    return page.items![rowIndex - page.position.start];
  });

  /**
   * Try to get a loaded row. Returns undefined if the row is not currently loaded.
   * @param rowIndex Index of the row to return.
   */
  public getLoadedRow(rowIndex: number): Readonly<RowItem> | undefined {
    return this._pages.getItem(rowIndex);
  }
}

const createColumns = (descriptor: content.Descriptor | undefined): ColumnDescription[] => {
  if (!descriptor)
    return [];
  const sortedFields = [...descriptor.fields];
  sortedFields.sort((a: content.Field, b: content.Field): number => {
    if (a.priority > b.priority)
      return -1;
    if (a.priority < b.priority)
      return 1;
    return 0;
  });
  return sortedFields.map((field) => createColumn(field));
};

const createColumn = (field: content.Field): ColumnDescription => {
  const propertyDescription = ContentBuilder.createPropertyDescription(field);
  return {
    key: field.name,
    label: field.label,
    propertyDescription,
    sortable: true,
    editable: !field.isReadonly,
    filterable: (field.type.valueFormat === content.PropertyValueFormat.Primitive),
  };
};

const createRows = (c: content.Content | undefined): RowItem[] => {
  if (!c)
    return [];
  return c.contentSet.map((item) => createRow(c.descriptor, item));
};

const createRow = (descriptor: content.Descriptor, item: content.Item): RowItem => {
  if (item.primaryKeys.length !== 1) {
    // note: for table view we expect the record to always have only 1 primary key
    throw new ECPresentationError(ECPresentationStatus.InvalidArgument, "content");
  }
  const row: RowItem = {
    key: item.primaryKeys[0],
    cells: new Array<CellItem>(),
  };
  for (const cellKey in item.values) {
    if (!item.values.hasOwnProperty(cellKey))
      continue;
    const field = descriptor.getFieldByName(cellKey);
    if (!field) {
      assert(false, "Record contains property '" + cellKey + "' which is not defined in content descriptor");
      continue;
    }
    const cell: CellItem = {
      key: cellKey,
      record: ContentBuilder.createPropertyRecord(field, item),
    };
    row.cells.push(cell);
  }
  return row;
};
