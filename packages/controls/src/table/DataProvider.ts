/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as _ from "lodash";
import { SortDirection } from "@bentley/ui-core/lib/enums/SortDirection";
import {
  TableDataProvider as ITableDataProvider, TableDataChangeEvent,
  ColumnDescription, RowItem, CellItem,
} from "@bentley/ui-components/lib/table/TableDataProvider";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentationError, ECPresentationStatus } from "@bentley/ecpresentation-common";
import * as content from "@bentley/ecpresentation-common/lib/content";
import ContentDataProvider, { CacheInvalidationProps } from "../common/ContentDataProvider";
import ContentBuilder from "../common/ContentBuilder";
import PageContainer, { Page } from "../common/PageContainer";
import { prioritySortFunction } from "../common/Utils";

interface PromisedPage<TItem> extends Page<TItem> {
  promise?: Promise<void>;
}

/**
 * Presentation Rules-driven table data provider.
 */
export default class ECPresentationTableDataProvider extends ContentDataProvider implements ITableDataProvider {
  private _sortColumnKey: string | undefined;
  private _sortDirection: SortDirection = SortDirection.NoSort;
  private _filterExpression: string | undefined;
  private _pages: PageContainer<RowItem, PromisedPage<RowItem>>;
  public onColumnsChanged = new TableDataChangeEvent();
  public onRowsChanged = new TableDataChangeEvent();

  /** Constructor. */
  constructor(connection: IModelConnection, rulesetId: string, pageSize: number = 20, cachedPagesCount: number = 5) {
    super(connection, rulesetId, content.DefaultContentDisplayTypes.GRID);
    this._pages = new PageContainer(pageSize, cachedPagesCount);
  }

  /**
   * `ECExpression` for filtering data in the table.
   */
  public get filterExpression(): string | undefined { return this._filterExpression; }
  public set filterExpression(value: string | undefined) {
    if (this._filterExpression === value)
      return;
    this._filterExpression = value;
    this.invalidateCache({ descriptorConfiguration: true, size: true, content: true });
  }

  /**
   * Get the column which is used for sorting data in the table.
   */
  public get sortColumn(): Promise<ColumnDescription | undefined> {
    return (async () => {
      if (!this._sortColumnKey)
        return undefined;
      const columns = await this.getColumns();
      return columns.find((col) => (col.key === this._sortColumnKey));
    })();
  }

  /**
   * Get key of the column which is used for sorting data in the table.
   */
  public get sortColumnKey() { return this._sortColumnKey; }

  /**
   * Get sort direction. Defaults to `SortDirection.NoSort` which means
   * undefined sorting.
   */
  public get sortDirection() { return this._sortDirection; }

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
    this.invalidateCache({ descriptorConfiguration: true, content: true });
  }

  protected invalidateCache(props: CacheInvalidationProps): void {
    super.invalidateCache(props);

    if (props.descriptor) {
      this._filterExpression = undefined;
      this._sortColumnKey = undefined;
      this._sortDirection = SortDirection.Ascending;
    }

    if (props.descriptor || props.descriptorConfiguration) {
      if (this.getColumns)
        this.getColumns.cache.clear();
      if (this.onColumnsChanged)
        this.onColumnsChanged.raiseEvent();
    }

    if (props.size || props.content) {
      if (this._pages)
        this._pages.invalidatePages();
      if (this.onRowsChanged)
        this.onRowsChanged.raiseEvent();
    }
  }

  /** Handles filtering and sorting. */
  protected configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    const configured = super.configureContentDescriptor(descriptor);
    if (this._sortColumnKey) {
      configured.sortingField = descriptor.getFieldByName(this._sortColumnKey)!;
      switch (this._sortDirection) {
        case SortDirection.Descending:
          configured.sortDirection = content.SortDirection.Descending;
          break;
        case SortDirection.Ascending:
          configured.sortDirection = content.SortDirection.Ascending;
          break;
        default:
          configured.sortDirection = undefined;
      }
    }
    configured.filterExpression = this._filterExpression;
    return configured;
  }

  /**
   * Returns column definitions.
   */
  public getColumns = _.memoize(async (): Promise<ColumnDescription[]> => {
    const descriptor = await this.getContentDescriptor();
    return createColumns(descriptor);
  });

  /**
   * Get the total number of rows.
   */
  public async getRowsCount() {
    return await this.getContentSetSize();
  }

  /**
   * Get a single row.
   * @param rowIndex Index of the row to return.
   */
  public async getRow(rowIndex: number): Promise<RowItem> {
    let page = this._pages.getPage(rowIndex);
    if (!page) {
      page = this._pages.reservePage(rowIndex);
      page.promise = this.getContent({
        start: page.position.start,
        size: page.position.end - page.position.start + 1,
      }).then((c: content.Content | undefined) => {
        page!.items = createRows(c);
      }).catch((e) => {
        throw e;
      });
    }
    await page.promise;
    return page.items![rowIndex - page.position.start];
  }

  /**
   * Try to get a loaded row. Returns undefined if the row is not currently loaded.
   * @param rowIndex Index of the row to return.
   */
  public getLoadedRow(rowIndex: number): Readonly<RowItem> | undefined {
    return this._pages.getItem(rowIndex);
  }
}

const createColumns = (descriptor: Readonly<content.Descriptor> | undefined): ColumnDescription[] => {
  if (!descriptor)
    return [];
  const sortedFields = [...descriptor.fields].sort(prioritySortFunction);
  return sortedFields.map((field) => createColumn(field));
};

const createColumn = (field: Readonly<content.Field>): ColumnDescription => {
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

const createRows = (c: Readonly<content.Content> | undefined): RowItem[] => {
  if (!c)
    return [];
  return c.contentSet.map((item) => createRow(c.descriptor, item));
};

const createRow = (descriptor: Readonly<content.Descriptor>, item: Readonly<content.Item>): RowItem => {
  if (item.primaryKeys.length !== 1) {
    // note: for table view we expect the record to always have only 1 primary key
    throw new ECPresentationError(ECPresentationStatus.InvalidArgument, "content");
  }
  const row: RowItem = {
    key: item.primaryKeys[0],
    cells: new Array<CellItem>(),
  };
  descriptor.fields.forEach((field) => {
    const cell: CellItem = {
      key: field.name,
      record: ContentBuilder.createPropertyRecord(field, item),
    };
    row.cells.push(cell);
  });
  return row;
};
