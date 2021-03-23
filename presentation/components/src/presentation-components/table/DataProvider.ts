/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import memoize from "micro-memoize";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  Content, DefaultContentDisplayTypes, Descriptor, DescriptorOverrides, Field, FieldDescriptorType, InstanceKey, Item, PresentationError,
  PresentationStatus, Ruleset, SortDirection,
} from "@bentley/presentation-common";
import { CellItem, ColumnDescription, TableDataProvider as ITableDataProvider, RowItem, TableDataChangeEvent} from "@bentley/ui-components";
import { SortDirection as UiSortDirection } from "@bentley/ui-core";
import { ContentBuilder } from "../common/ContentBuilder";
import { CacheInvalidationProps, ContentDataProvider, IContentDataProvider } from "../common/ContentDataProvider";
import { Page, PageContainer } from "../common/PageContainer";
import { createLabelRecord, priorityAndNameSortFunction, translate } from "../common/Utils";

interface PromisedPage<TItem> extends Page<TItem> {
  promise?: Promise<void>;
}

/**
 * The default number of rows in a single page requested by [[PresentationTableDataProvider]]
 * @public
 */
export const TABLE_DATA_PROVIDER_DEFAULT_PAGE_SIZE = 20;

/**
 * The default number of pages cached by [[PresentationTableDataProvider]]
 * @public
 */
export const TABLE_DATA_PROVIDER_DEFAULT_CACHED_PAGES_COUNT = 5;

/**
 * Interface for presentation rules-driven table data provider.
 * @public
 */
export type IPresentationTableDataProvider = ITableDataProvider & IContentDataProvider & {
  /** Get key of ECInstance that's represented by the supplied row */
  getRowKey: (row: RowItem) => InstanceKey;
};

/**
 * Initialization properties for [[PresentationTableDataProvider]]
 * @public
 */
export interface PresentationTableDataProviderProps {
  /** IModel to pull data from */
  imodel: IModelConnection;

  /** Ruleset or it's ID to be used for creating the content */
  ruleset: string | Ruleset;

  /** Number of rows in a single page requested from the backend. Defaults to [[TABLE_DATA_PROVIDER_DEFAULT_PAGE_SIZE]] */
  pageSize?: number;

  /** Number of pages cached in the data provider. Defaults to [[TABLE_DATA_PROVIDER_DEFAULT_CACHED_PAGES_COUNT]] */
  cachedPagesCount?: number;

  /** Display type to use when requesting data from the backend. Defaults to [[DefaultContentDisplayTypes.Grid]] */
  displayType?: string;

  /**
   * Auto-update table content when ruleset, ruleset variables or data in the iModel changes.
   * @alpha
   */
  enableContentAutoUpdate?: boolean;
}

/**
 * Presentation Rules-driven table data provider.
 * @public
 */
export class PresentationTableDataProvider extends ContentDataProvider implements IPresentationTableDataProvider {
  private _sortColumnKey: string | undefined;
  private _sortDirection = UiSortDirection.NoSort;
  private _filterExpression: string | undefined;
  private _pages: PageContainer<RowItem, PromisedPage<RowItem>>;
  public onColumnsChanged = new TableDataChangeEvent();
  public onRowsChanged = new TableDataChangeEvent();

  /** Constructor. */
  constructor(props: PresentationTableDataProviderProps) {
    super({
      imodel: props.imodel,
      ruleset: props.ruleset,
      displayType: props.displayType || DefaultContentDisplayTypes.Grid,
      pagingSize: props.pageSize || TABLE_DATA_PROVIDER_DEFAULT_PAGE_SIZE,
      enableContentAutoUpdate: props.enableContentAutoUpdate,
    });
    this._pages = new PageContainer(props.pageSize || TABLE_DATA_PROVIDER_DEFAULT_PAGE_SIZE,
      props.cachedPagesCount || TABLE_DATA_PROVIDER_DEFAULT_CACHED_PAGES_COUNT);
  }

  /** Get key of ECInstance that's represented by the supplied row */
  public getRowKey(row: RowItem): InstanceKey {
    return InstanceKey.fromJSON(JSON.parse(row.key));
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
  public async sort(columnIndex: number, sortDirection: UiSortDirection): Promise<void> {
    const columns = await this.getColumns();
    const sortingColumn = columns[columnIndex];
    if (!sortingColumn)
      throw new PresentationError(PresentationStatus.InvalidArgument, "Invalid column index");
    this._sortColumnKey = sortingColumn.key;
    this._sortDirection = sortDirection;
    this.invalidateCache({ descriptorConfiguration: true, content: true });
  }

  protected invalidateCache(props: CacheInvalidationProps): void {
    super.invalidateCache(props);

    if (props.descriptor) {
      this._filterExpression = undefined;
      this._sortColumnKey = undefined;
      this._sortDirection = UiSortDirection.NoSort;
    }

    if (props.descriptor || props.descriptorConfiguration) {
      if (this.getColumns) {
        this.getColumns.cache.keys.length = 0;
        this.getColumns.cache.values.length = 0;
      }
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

  /**
   * Tells the data provider to _not_ request descriptor and instead configure
   * content using `getDescriptorOverrides()` call
   */
  protected shouldConfigureContentDescriptor(): boolean { return false; }

  /**
   * Provides content configuration for the property grid
   */
  protected getDescriptorOverrides(): DescriptorOverrides {
    const overrides = super.getDescriptorOverrides();
    if (this._sortColumnKey && this._sortDirection !== UiSortDirection.NoSort) {
      overrides.sorting = {
        field: { type: FieldDescriptorType.Name, fieldName: this._sortColumnKey },
        direction: (this._sortDirection === UiSortDirection.Descending) ? SortDirection.Descending : SortDirection.Ascending,
      };
    }
    if (this._filterExpression)
      overrides.filterExpression = this._filterExpression;
    return overrides;
  }

  /**
   * Returns column definitions.
   */
  public getColumns = memoize(async (): Promise<ColumnDescription[]> => {
    const descriptor = await this.getContentDescriptor();
    return createColumns(descriptor);
  });

  /**
   * Get the total number of rows.
   */
  public async getRowsCount() {
    return this.getContentSetSize();
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
      }).then((c: Content | undefined) => {
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

const DISPLAY_LABEL_COLUMN_KEY = "/DisplayLabel/";

const createColumns = (descriptor: Readonly<Descriptor> | undefined): ColumnDescription[] => {
  if (!descriptor)
    return [];

  if (descriptor.displayType === DefaultContentDisplayTypes.List)
    return [createLabelColumn()];

  const sortedFields = [...descriptor.fields].sort(priorityAndNameSortFunction);
  return sortedFields.map((field) => createColumn(field));
};

const createColumn = (field: Readonly<Field>): ColumnDescription => {
  return {
    key: field.name,
    label: field.label,
    sortable: true,
    editable: !field.isReadonly,
    filterable: false,
    // note: disable column filtering until this data provider supports filtering
    // filterable: (field.type.valueFormat === PropertyValueFormat.Primitive),
  };
};

const createLabelColumn = (): ColumnDescription => {
  return {
    key: DISPLAY_LABEL_COLUMN_KEY,
    label: translate("general.display-label"),
    sortable: true,
    editable: false,
    filterable: false,
  };
};

const createRows = (c: Readonly<Content> | undefined): RowItem[] => {
  if (!c)
    return [];
  return c.contentSet.map((item) => createRow(c.descriptor, item));
};

const createRow = (descriptor: Readonly<Descriptor>, item: Readonly<Item>): RowItem => {
  if (item.primaryKeys.length !== 1) {
    // note: for table view we expect the record to always have only 1 primary key
    throw new PresentationError(PresentationStatus.InvalidArgument, "item.primaryKeys");
  }

  const key = JSON.stringify(item.primaryKeys[0]);
  if (descriptor.displayType === DefaultContentDisplayTypes.List) {
    return {
      key,
      cells: [{
        key: DISPLAY_LABEL_COLUMN_KEY,
        record: createLabelRecord(item.label, "content_item_label"),
      }],
    };
  }

  return {
    key,
    cells: descriptor.fields.map((field): CellItem => ({
      key: field.name,
      record: ContentBuilder.createPropertyRecord({ field }, item).record,
    })),
  };
};
