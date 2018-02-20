/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import ContentDataProvider from "./ContentDataProvider";
import ContentBuilder, { PropertyDescription } from "./ContentBuilder";
import * as content from "../../common/content";
import { isPrimitiveDescription } from "../../common/content/TypeDescription";
import { InstanceKey } from "../../common/EC";
import { ECPresentationManager, PageOptions } from "../../common/ECPresentationManager";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export enum SortDirection {
  Ascending,
  Descending,
}

export interface ColumnDescription {
  key: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  description?: PropertyDescription;
}

export interface CellItem {
  key: string;
  value: any;
  displayValue: any;
  isDisabled: boolean;
  isBold: boolean;
  isItalic: boolean;
}

export interface RowItem {
  key: InstanceKey;
  cells: CellItem[];
}

class Page {
  private _pageStart: number;
  private _pageEnd: number;
  private _rowsPromise: Promise<RowItem[]> | undefined;
  public rows: RowItem[];

  constructor(pageStart: number, pageEnd: number) {
    this._pageStart = pageStart;
    this._pageEnd = pageEnd;
    this._rowsPromise = undefined;
    this.rows = new Array<RowItem>();
  }

  public get pageStart() { return this._pageStart; }
  public get pageEnd() { return this._pageEnd; }

  public get rowsPromise(): Promise<RowItem[]> {
    if (!this._rowsPromise) {
      assert(false, "Content promise was not set");
      return Promise.resolve<RowItem[]>([]);
    }
    return this._rowsPromise;
  }

  public setContentPromise(value: Promise<content.Content>) {
    const self = this;
    this._rowsPromise = value.then((c: content.Content) => {
      self.fillFromContent(c);
      return self.rows;
    });
  }

  private fillFromContent(c: content.Content) {
    const pageSize = this._pageEnd - this._pageStart;
    const rows = new Array<RowItem>();
    for (let i = 0; i < c.contentSet.length && i < pageSize; ++i) {
      const row = Page.createRowItemFromContentRecord(c.descriptor, c.contentSet[i]);
      rows.push(row);
    }
    this.rows = rows;
  }

  private static createRowItemFromContentRecord(descriptor: content.Descriptor, record: content.Item): RowItem {
    // note: for table view we expect the record to always have only 1 primary key
    assert(1 === record.primaryKeys.length);

    const row: RowItem = {
      key: {
        classId: record.primaryKeys[0].classId.toString(),
        instanceId: record.primaryKeys[0].instanceId.toString(),
      },
      cells: new Array<CellItem>(),
    };

    for (const cellKey in record.values) {
      if (!record.values.hasOwnProperty(cellKey))
        continue;

      const field = getFieldByName(descriptor, cellKey);
      if (!field) {
        assert(false, "Record contains property '" + cellKey + "' which is not defined in ContentDescriptor");
        continue;
      }

      const cell: CellItem = {
        key: cellKey,
        value: ContentBuilder.createPropertyRecord(field, record),
        displayValue: record.displayValues[cellKey],
        isDisabled: false,
        isBold: false,
        isItalic: false,
      };

      row.cells.push(cell);
    }

    return row;
  }
}

class PageContainer {
  private _pageSize: number;
  private _maxPages: number;
  private _pages: Page[] = [];

  constructor(pageSize: number, maxPages: number) {
    this._pageSize = pageSize;
    this._maxPages = maxPages;
  }

  public get pageSize() { return this._pageSize; }
  public set pageSize(value: number) {
    this._pageSize = value;
    this.invalidatePages();
  }

  public invalidatePages(): void { this._pages = []; }

  public getPage(index: number): Page | undefined {
    for (const page of this._pages) {
      if (page.pageStart <= index && index < page.pageEnd)
        return page;
    }
    return undefined;
  }

  public getRow(index: number): RowItem | undefined {
    const page = this.getPage(index);
    if (!page)
      return undefined;
    return page.rows[index - page.pageStart];
  }

  public getIndex(item: RowItem): number {
    for (const page of this._pages) {
      for (let i = 0; i < page.rows.length; ++i) {
        const row = page.rows[i];
        if (row === item)
          return page.pageStart + i;
      }
    }
    return -1;
  }

  public createPage(index: number): Page {
    // find the place for the new page to insert
    let pageIndex: number = 0;
    for (const page of this._pages) {
      if (page.pageStart > index)
        break;
      pageIndex++;
    }
    const pageBefore = (pageIndex > 0) ? this._pages[pageIndex - 1] : undefined;
    const pageAfter = (pageIndex < this._pages.length) ? this._pages[pageIndex] : undefined;

    // determine the start of the page for the specified index
    let pageStartIndex = index;
    let pageSize = this.pageSize;
    if (undefined !== pageAfter && pageStartIndex > pageAfter.pageStart - this.pageSize) {
      pageStartIndex = pageAfter.pageStart - this.pageSize;
    }
    if (undefined !== pageBefore && pageBefore.pageEnd > pageStartIndex) {
      pageStartIndex = pageBefore.pageEnd;
      pageSize = pageAfter!.pageStart - pageBefore.pageEnd;
    }
    if (pageStartIndex < 0)
      pageStartIndex = 0;
    if (pageSize < 0) {
      assert(false, "Invalid page size");
      pageSize = 1;
    }

    // create the new page
    const newPage = new Page(pageStartIndex, pageStartIndex + pageSize);
    this._pages.splice(pageIndex, 0, newPage);

    // dispose old pages, if necessary
    if (this._pages.length > this._maxPages) {
      // we drop the page that's furthest from the newly created one
      const distanceToFront = pageIndex;
      const distanceToBack = this._pages.length - pageIndex - 1;
      if (distanceToBack > distanceToFront)
        this._pages.pop();
      else
        this._pages.splice(0, 1);
    }

    return newPage;
  }
}

const getFieldByName = (descriptor: content.Descriptor, name: string): content.Field | undefined => {
  for (const field of descriptor.fields) {
    if (field.name === name)
      return field;
  }
  return undefined;
};

export default class TableViewDataProvider extends ContentDataProvider {
  private _sortColumnKey: string | undefined;
  private _sortDirection: SortDirection = SortDirection.Ascending;
  private _filterExpression: string | undefined;
  private _pages: PageContainer;
  private _keys: InstanceKey[];

  /** Constructor. */
  constructor(manager: ECPresentationManager, imodelToken: IModelToken, rulesetId: string, pageSize: number = 20, cachedPagesCount: number = 5) {

    super(manager, imodelToken, rulesetId, content.DefaultContentDisplayTypes.GRID);

    this._pages = new PageContainer(pageSize, cachedPagesCount);
    this._keys = [];
  }

  protected invalidateCache(): void {
    this._filterExpression = undefined;
    this._sortColumnKey = undefined;
    this._sortDirection = SortDirection.Ascending;

    if (undefined !== this._pages)
      this._pages.invalidatePages();

    super.invalidateCache();
  }

  protected invalidateContentCache(invalidateContentSetSize: boolean, invalidatePages: boolean = true): void {
    super.invalidateContentCache(invalidateContentSetSize);

    if (invalidatePages && this._pages)
      this._pages.invalidatePages();
  }

  /** Handles filtering and sorting. */
  protected configureContentDescriptor(descriptor: content.Descriptor): void {
    super.configureContentDescriptor(descriptor);

    if (undefined !== this._sortColumnKey) {
      const sortingField = getFieldByName(descriptor, this._sortColumnKey);
      if (undefined !== sortingField) {
        descriptor.sortingField = sortingField;
        descriptor.sortDirection = this._sortDirection;
      }
    }

    descriptor.filterExpression = this._filterExpression;
  }

  public get keys() { return this._keys; }
  public set keys(keys: InstanceKey[]) {
    this._keys = keys;
    this.invalidateCache();
  }

  /** Returns column definitions for the content. */
  public async getColumns(): Promise<ColumnDescription[]> {
    // setup onFulfilled promise function
    const getColumnsFromDescriptor = (descriptor: content.Descriptor): ColumnDescription[] => {
      const cols = new Array<ColumnDescription>();
      if (!descriptor)
        return cols;

      const sortedFields = descriptor.fields.slice();
      sortedFields.sort((a: content.Field, b: content.Field): number => {
        if (a.priority > b.priority)
          return -1;
        if (a.priority < b.priority)
          return 1;
        return 0;
      });

      for (const field of sortedFields) {
        const propertyDescription = ContentBuilder.createPropertyDescription(field);
        const columnDescription: ColumnDescription = {
          key: field.name,
          label: field.label,
          description: propertyDescription,
          sortable: true,
          editable: !field.isReadOnly,
          filterable: isPrimitiveDescription(field.description),
        };
        cols.push(columnDescription);
      }
      return cols;
    };

    // setup onRejected promise function
    const handleError = (): ColumnDescription[] => {
      return [];
    };

    return this.getContentDescriptor(this.keys).then(getColumnsFromDescriptor).catch(handleError);
  }

  /** Sorts the data in this data provider.
   * @param[in] columnIndex Index of the column to sort on.
   * @param[in] sortDirection Sorting direction.
   */
  public sort(columnIndex: number, sortDirection: SortDirection): void {
    const self = this;
    const sort = (column: ColumnDescription) => {
      self._sortColumnKey = column.key;
      self._sortDirection = sortDirection;
      self.invalidateContentCache(false);
    };
    const getSortingColumn = (columns: ColumnDescription[]) => {
      return columns[columnIndex];
    };

    this.getColumns().then(getSortingColumn).then(sort);
  }

  /** Get the total number of rows in the content. */
  public async getRowsCount(): Promise<number> { return this.getContentSetSize(this.keys); }

  /** Get a single row.
   * @param[in] rowIndex Index of the row to return.
   * @param[in] _unfiltered (not used)
   */
  public async getRow(rowIndex: number, _unfiltered?: boolean): Promise<RowItem> {
    let page = this._pages.getPage(rowIndex);
    if (!page) {
      this.invalidateContentCache(false, false);
      page = this._pages.createPage(rowIndex);
      page.setContentPromise(this.getContent(this.keys, undefined, { pageStart: page.pageStart, pageSize: page.pageEnd - page.pageStart } as PageOptions));
    }
    return page.rowsPromise.then((rows: RowItem[]) => {
      return rows[rowIndex - page!.pageStart];
    });
  }

  /** Try to get the loaded row. Returns undefined if the row is not currently cached.
   * @param[in] rowIndex Index of the row to return.
   * @param[in] unfiltered (not used)
   */
  public getLoadedRow(rowIndex: number, _unfiltered?: boolean): RowItem | undefined {
    return this._pages.getRow(rowIndex);
  }
}
