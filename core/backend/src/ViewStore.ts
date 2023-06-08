/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { CompressedId64Set, GuidString, Id64, Id64Array, Id64String, MarkRequired, Optional } from "@itwin/core-bentley";
import {
  AddViewArgs, CategorySelectorProps, DisplayStyle3dSettingsProps, DisplayStyleLoadProps, DisplayStyleProps, DisplayStyleSettingsProps,
  DisplayStyleSubCategoryProps, ElementProps, IModel, isViewStoreId, ModelSelectorProps, PlanProjectionSettingsProps, ReadViewStoreRpc,
  RenderSchedule, RenderTimelineProps, SpatialViewDefinitionProps, ThumbnailFormatProps, ThumbnailProps, ViewDefinitionProps, ViewGroupSpec,
  ViewListEntry, ViewName, ViewQueryParams, ViewStoreIdString, WriteViewStoreRpc,
} from "@itwin/core-common";
import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";

import type { IModelDb } from "./IModelDb";

// cspell:ignore nocase rowid

/**
 * A ViewStore is a database that stores Views and related data. It is used to store and retrieve views for iTwin.js.
 * It can either be a local SQLite file, or a CloudSqlite database stored in a cloud container. To use a CloudSqlite
 * database, you must first create a container in Blob Storage and then call [[ViewStore.CloudAccess.initializeDb]].
 *
 * A ViewStore can hold:
 * - Views
 * - DisplayStyles
 * - CategorySelectors
 * - ModelSelectors
 * - RenderTimelines
 * - Searches
 * - Tags
 * - Thumbnails
 * - ViewGroups
 *
 * Views are added to a ViewStore via ViewDefinitionProps that may hold references to a DisplayStyle, CategorySelector, ModelSelector, or RenderTimeline.
 * Before storing a View, you must first add any referenced DisplayStyles, CategorySelectors, ModelSelectors, and RenderTimelines to the
 * ViewStore. The "add" methods return a string that uniquely identifies the object in the ViewStore.
 * You should set the ViewDefinitionProps's displayStyle, categorySelector, modelSelector, or renderTimeline member to the returned string.
 * When you load a ViewDefinition from the ViewStore, the member may be used to load the DisplayStyle, CategorySelector,
 * ModelSelector, RenderTimeline, etc.
 *
 * A ViewStoreId is a string that uniquely identifies a row in one of the ViewStore's internal tables. The string holds a base-36 integer
 * that starts with "@" (vs. "0x" for ElementIds). For example, if you store a DisplayStyle and it is assigned the ViewStore Id "@y1", then you
 * should set the ViewDefinitionProps's displayStyle member to "@y1". When you load the ViewDefinition from the ViewStore, the "@Y1" may be used to
 * alo load the DisplayStyle from the ViewStore.
 *
 * Views are organized into hierarchical ViewGroups (like file and folder hierarchies on a file system). A View is always stored "in" a ViewGroup, and
 * views must have a name that is unique within the ViewGroup. ViewGroups may each have a default ViewId.
 * The root ViewGroup is named "Root" and has a RowId of 1. The root ViewGroup can not be deleted.
 * View names and ViewGroup names may not contain either "/" or "@". ViewGroups are stored in the "viewGroups" table.
 *
 * Views may be "tagged" with one or more Tags. Tags are named with an arbitrary string that can be used to group Views. A Tag may
 * be associated with multiple Views, and a View may have multiple Tags. Tags are stored in the "tags" table.
 *
 * Views may optionally have a thumbnail, paired via the View's Id. Thumbnails are stored in the "thumbnails" table.
 *
 * Note: All ElementIds and ModelIds in ModelSelectors, CategorySelectors, DisplayStyles, Timelines, etc. are converted to guid-based identifiers when stored in the ViewStore.
 * They are then remapped back to their Ids when loaded from the ViewStore. This allows the ViewStore to be used with more than one iModel,
 * provided that the same Guids are used in each iModel. This is done by storing the set of unique Guids in the "guids" table, and then
 * creating a reference to the row in the "guids" table via the special Id prefix "^". For example, if a category selector contains the
 * Id "0x123", then the guid from element 0x123 is stored in the "guids" table, and the category selector is stored with the rowId of the entry
 * in the guid table (e.g. "^1w"). When the category selector is loaded from the ViewStore, the guid is looked up in the "guids" table and
 * the iModel is queried for the element with that guid. That element's Id (which may or may not be 0x123) is then returned in the category selector.
 *
 * @beta
 */
export namespace ViewStore {

  export const tableName = {
    categorySelectors: "categorySelectors",
    displayStyles: "displayStyles",
    viewGroups: "viewGroups",
    guids: "guids",
    modelSelectors: "modelSelectors",
    taggedViews: "taggedViews",
    tags: "tags",
    thumbnails: "thumbnails",
    timelines: "timelines",
    searches: "searches",
    views: "views",
  } as const;

  /** data for a Thumbnail */
  export type ThumbnailData = Uint8Array;

  /** A row in a table. 0 means "not present" */
  export type RowId = number;

  /** a string representation of a row in a table of a ViewStore. Will be a base-36 integer with a leading "@" (e.g."@4e3") */
  export type RowString = string;

  /** a string representation of a row in the Guid table. Will be a base-36 integer with a leading "^" (e.g."^4e3") */
  export type GuidRowString = string;

  /** common properties for all tables */
  export interface TableRow {
    name?: string;
    json: string;
    owner?: string;
  }
  export type DisplayStyleRow = TableRow;
  export type SelectorRow = TableRow;
  export type TagRow = TableRow;
  export type SearchRow = TableRow;
  export type TimelineRow = TableRow;

  /** a row in the "views" table */
  export interface ViewRow extends MarkRequired<TableRow, "name"> {
    className: string;
    groupId: RowId;
    isPrivate?: boolean;
    modelSel?: RowId;
    categorySel?: RowId;
    displayStyle?: RowId;
  }

  export interface ViewGroupProps {
    defaultViewId?: RowString;
  }

  /** a row in the "viewGroups" table */
  export interface ViewGroupRow extends MarkRequired<TableRow, "name"> {
    parentId: RowId;
  }

  /** a row in the "thumbnails" table */
  export interface ThumbnailRow {
    viewId: RowId;
    data: ThumbnailData;
    format: ThumbnailFormatProps;
    owner?: string;
  }
  /** a row in the "taggedViews" table */
  export interface TaggedViewRow {
    viewId: RowId;
    tagId: RowId;
  }

  /** convert a RowId to a RowString (base-36 integer with a leading "@") */
  export const tableRowIdToString = (rowId: RowId): RowString => {
    return `@${rowId.toString(36)}`;
  };
  /** convert a guid RowId to a GuidRowString (base-36 integer with a leading "^") */
  export const guidRowToString = (rowId: RowId): GuidRowString => {
    return `^${rowId.toString(36)}`;
  };

  /** determine if a string is a guid row string (base-36 integer with a leading "^") */
  const isGuidRowString = (id?: string) => true === id?.startsWith("^");

  export const rowIdFromString = (id: RowString): RowId => {
    if (!isViewStoreId(id) && !isGuidRowString(id))
      throw new Error(`invalid value: ${id}`);
    return parseInt(id.slice(1), 36);
  };

  const blankElementProps = (from: any, classFullName: string, idString: RowString, name?: string): ElementProps => {
    from.id = idString;
    from.classFullName = classFullName;
    from.model = IModel.dictionaryId;
    from.code = { spec: "0x1", scope: "0x1", value: name };
    return from;
  };
  const stringifyProps = (props: Partial<ElementProps>): string => {
    delete props.id;
    delete props.federationGuid;
    delete props.parent;
    delete props.code;
    delete props.model;
    return JSON.stringify(props);
  };
  const validateName = (name: string, msg: string) => {
    if (name.trim().length === 0 || (/[@^#<>:"/\\"`'|?*\u0000-\u001F]/g.test(name)))
      throw new Error(`illegal ${msg} name "${name}"`);
  };

  export const defaultViewGroupId = 1 as const;

  export class ViewDb extends VersionedSqliteDb implements WriteViewStoreRpc, ReadViewStoreRpc {
    public override myVersion = "4.0.0";
    private _elements?: IModelDb.GuidMapper;
    public get elements() { return this._elements!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion
    public set elements(elements: IModelDb.GuidMapper) { this._elements = elements; }

    public constructor(props?: { elements?: IModelDb.GuidMapper }) {
      super();
      this._elements = props?.elements;
    }

    /** create all the tables for a new ViewDb */
    protected override createDDL() {
      const baseCols = "Id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT,owner TEXT";
      this.createTable({
        tableName: tableName.views,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,className TEXT NOT NULL,private BOOLEAN NOT NULL,` +
          `groupId INTEGER NOT NULL REFERENCES ${tableName.viewGroups}(Id) ON DELETE CASCADE, ` +
          `modelSel INTEGER REFERENCES ${tableName.modelSelectors}(Id), ` +
          `categorySel INTEGER REFERENCES ${tableName.categorySelectors}(Id), ` +
          `displayStyle INTEGER REFERENCES ${tableName.displayStyles}(Id)`,
        constraints: "UNIQUE(groupId,name)",
        addTimestamp: true,
      });
      this.createTable({
        tableName: tableName.viewGroups,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,parent INTEGER NOT NULL REFERENCES ${tableName.viewGroups}(Id) ON DELETE CASCADE`,
        constraints: "UNIQUE(parent,name)",
        addTimestamp: true,
      });

      // for tables that have a "name" column, we want to enforce case-insensitive uniqueness. Names may be null.
      const makeTable = (table: string, extra?: string) => {
        this.createTable({ tableName: table, columns: `${baseCols},name TEXT UNIQUE COLLATE NOCASE${extra ?? ""}`, addTimestamp: true });
      };

      makeTable(tableName.modelSelectors);
      makeTable(tableName.categorySelectors);
      makeTable(tableName.displayStyles);
      makeTable(tableName.timelines);
      makeTable(tableName.tags);
      makeTable(tableName.searches);
      this.createTable({ tableName: tableName.thumbnails, columns: `Id INTEGER PRIMARY KEY REFERENCES ${tableName.views} (Id) ON DELETE CASCADE,json,owner,data BLOB NOT NULL` });
      this.createTable({
        tableName: tableName.taggedViews, columns: `viewId INTEGER NOT NULL REFERENCES ${tableName.views} (Id) ON DELETE CASCADE,` +
          `tagId INTEGER NOT NULL REFERENCES ${tableName.tags} (Id) ON DELETE CASCADE`,
        constraints: `UNIQUE(tagId,viewId)`,
      });
      this.createTable({ tableName: tableName.guids, columns: `guid BLOB NOT NULL UNIQUE` });
      this.addViewGroupRow({ name: "Root", json: JSON.stringify({}) });
    }

    /** get the row in the "guids" table for a given guid. If the guid is not present, return 0 */
    private getGuidRow(guid: GuidString): RowId {
      return this.withPreparedSqliteStatement(`SELECT rowId FROM ${tableName.guids} WHERE guid=? `, (stmt) => {
        stmt.bindGuid(1, guid);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public getGuid(rowid: RowId): GuidString | undefined {
      return this.withSqliteStatement(`SELECT guid FROM ${tableName.guids} WHERE rowId=? `, (stmt) => {
        stmt.bindInteger(1, rowid);
        return !stmt.nextRow() ? undefined : stmt.getValueGuid(0);
      });
    }
    /** @internal */
    public iterateGuids(rowIds: RowId[], fn: (guid: GuidString, row: RowId) => void) {
      this.withSqliteStatement(`SELECT guid FROM ${tableName.guids} WHERE rowId=? `, (stmt) => {
        for (const rowId of rowIds) {
          stmt.reset();
          stmt.bindInteger(1, rowId);
          if (stmt.nextRow())
            fn(stmt.getValueGuid(0), rowId);
        }
      });
    }

    /** @internal */
    public addGuid(guid: GuidString): RowId {
      const existing = this.getGuidRow(guid);
      return existing !== 0 ? existing : this.withPreparedSqliteStatement(`INSERT INTO ${tableName.guids} (guid) VALUES(?)`, (stmt) => {
        stmt.bindGuid(1, guid);
        stmt.stepForWrite();
        return this.nativeDb.getLastInsertRowId();
      });
    }

    /** @internal */
    public addViewRow(args: ViewRow): RowId {
      validateName(args.name, "view");

      return this.withSqliteStatement(`INSERT INTO ${tableName.views} (className,name,json,owner,private,groupId,modelSel,categorySel,displayStyle) VALUES(?,?,?,?,?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        stmt.bindBoolean(5, args.isPrivate ?? false);
        stmt.bindInteger(6, args.groupId ?? 1);
        stmt.maybeBindInteger(7, args.modelSel);
        stmt.maybeBindInteger(8, args.categorySel);
        stmt.maybeBindInteger(9, args.displayStyle);
        stmt.stepForWrite();
        return this.nativeDb.getLastInsertRowId();
      });
    }

    /** @internal */
    public addViewGroupRow(args: Optional<ViewGroupRow, "parentId">): RowId {
      validateName(args.name, "group");
      return this.withSqliteStatement(`INSERT INTO ${tableName.viewGroups} (name,owner,parent,json) VALUES(?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.name);
        stmt.maybeBindString(2, args.owner);
        stmt.bindInteger(3, args.parentId ?? 1);
        stmt.bindString(4, args.json);
        stmt.stepForWrite();
        return this.nativeDb.getLastInsertRowId();
      });
    }

    private addTableRow(table: string, args: TableRow): RowId {
      return this.withSqliteStatement(`INSERT INTO ${table} (name,json,owner) VALUES(?,?,?)`, (stmt) => {
        stmt.maybeBindString(1, args.name);
        stmt.bindString(2, args.json);
        stmt.maybeBindString(3, args.owner);
        stmt.stepForWrite();
        return this.nativeDb.getLastInsertRowId();
      });
    }
    /** add a row to the "modelSelectors" table, return the RowId */
    public addModelSelectorRow(args: SelectorRow): RowId {
      return this.addTableRow(tableName.modelSelectors, args);
    }
    /** add a row to the "categorySelectors" table, return the RowId */
    public addCategorySelectorRow(args: SelectorRow): RowId { // for tests
      return this.addTableRow(tableName.categorySelectors, args);
    }
    /** add a row to the "displayStyles" table, return the RowId */
    public addDisplayStyleRow(args: DisplayStyleRow): RowId {
      return this.addTableRow(tableName.displayStyles, args);
    }
    /** add a row to the "timelines" table, return the RowId */
    public addTimelineRow(args: TimelineRow): RowId {
      return this.addTableRow(tableName.timelines, args);
    }
    /** add a row to the "tags" table, return the RowId */
    public addTag(args: TagRow): RowId {
      return this.addTableRow(tableName.tags, args);
    }
    /** add a row to the "searches" table, return the RowId */
    public async addSearch(args: SearchRow): Promise<RowId> {
      return this.addTableRow(tableName.searches, args);
    }

    /** add or update a row in the "thumbnails" table, return the RowId */
    public addOrReplaceThumbnailRow(args: ThumbnailRow): RowId {
      return this.withSqliteStatement(`INSERT OR REPLACE INTO ${tableName.thumbnails} (Id,json,owner,data) VALUES(?,?,?,?)`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindString(2, JSON.stringify(args.format));
        stmt.maybeBindString(3, args.owner);
        stmt.bindBlob(4, args.data);
        stmt.stepForWrite();
        return this.nativeDb.getLastInsertRowId();
      });
    }

    private deleteFromTable(table: string, id: RowId): void {
      this.withSqliteStatement(`DELETE FROM ${table} WHERE Id=? `, (stmt) => {
        stmt.bindInteger(1, id);
        stmt.stepForWrite();
      });
    }
    public deleteViewRow(id: RowId) {
      return this.deleteFromTable(tableName.views, id);
    }
    public async deleteViewGroup(args: { name: ViewGroupSpec }) {
      const rowId = this.findViewGroup(args.name);
      if (rowId === 1)
        throw new Error("Cannot delete root group");
      return this.deleteFromTable(tableName.viewGroups, rowId);
    }
    public deleteModelSelector(id: RowId) {
      return this.deleteFromTable(tableName.modelSelectors, id);
    }
    public deleteCategorySelector(id: RowId) {
      return this.deleteFromTable(tableName.categorySelectors, id);
    }
    public deleteDisplayStyle(id: RowId) {
      return this.deleteFromTable(tableName.displayStyles, id);
    }
    public deleteTimeline(id: RowId) {
      return this.deleteFromTable(tableName.timelines, id);
    }
    public deleteTag(id: RowId) {
      return this.deleteFromTable(tableName.tags, id);
    }
    public deleteSearch(id: RowId) {
      return this.deleteFromTable(tableName.searches, id);
    }
    public deleteThumbnailSync(id: RowString) {
      return this.deleteFromTable(tableName.thumbnails, rowIdFromString(id));
    }
    public async deleteThumbnail(arg: { id: RowString }) {
      return this.deleteThumbnailSync(arg.id);
    }
    /** get the data for a view from the database */
    public getViewRow(viewId: RowId): undefined | ViewRow {
      return this.withSqliteStatement(`SELECT className,name,json,owner,private,groupId,modelSel,categorySel,displayStyle FROM ${tableName.views} WHERE Id=? `, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
          isPrivate: stmt.getValueBoolean(4),
          groupId: stmt.getValueInteger(5),
          modelSel: stmt.getValueIntegerMaybe(6),
          categorySel: stmt.getValueIntegerMaybe(7),
          displayStyle: stmt.getValueIntegerMaybe(8),
        };
      });
    }
    public getThumbnailRow(viewId: RowId): undefined | ThumbnailRow {
      return this.withSqliteStatement(`SELECT json,owner,data FROM ${tableName.thumbnails} WHERE Id=? `, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : {
          viewId,
          format: JSON.parse(stmt.getValueString(0)),
          owner: stmt.getValueStringMaybe(1),
          data: stmt.getValueBlob(2),
        };
      });
    }
    public getViewGroup(id: RowId): ViewGroupRow | undefined {
      return this.withSqliteStatement(`SELECT name,owner,json,parent FROM ${tableName.viewGroups} WHERE Id=? `, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          name: stmt.getValueString(0),
          owner: stmt.getValueStringMaybe(1),
          json: stmt.getValueString(2),
          parentId: stmt.getValueInteger(3),
        };
      });
    }

    private getTableRow(table: string, id: RowId): SelectorRow | undefined {
      return this.withSqliteStatement(`SELECT name,json,owner FROM ${table} WHERE Id=? `, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          name: stmt.getValueStringMaybe(0),
          json: stmt.getValueString(1),
          owner: stmt.getValueStringMaybe(2),
        };
      });
    }

    /** read a ModelSelector given a rowId */
    public getModelSelector(id: RowId): SelectorRow | undefined {
      return this.getTableRow(tableName.modelSelectors, id);
    }
    /** read a CategorySelector given a rowId */
    public getCategorySelector(id: RowId): SelectorRow | undefined {
      return this.getTableRow(tableName.categorySelectors, id);
    }
    /** read a DisplayStyle given a rowId */
    public getDisplayStyle(id: RowId): DisplayStyleRow | undefined {
      return this.getTableRow(tableName.displayStyles, id);
    }
    public getTimelineRow(id: RowId): TimelineRow | undefined {
      return this.getTableRow(tableName.timelines, id);
    }
    public getTag(id: RowId): TagRow | undefined {
      return this.getTableRow(tableName.tags, id);
    }
    public getSearch(id: RowId): SearchRow | undefined {
      return this.getTableRow(tableName.searches, id);
    }

    private async updateJson(table: string, id: RowId, json: string): Promise<void> {
      this.withSqliteStatement(`UPDATE ${table} SET json=? WHERE Id=? `, (stmt) => {
        stmt.bindString(1, json);
        stmt.bindInteger(2, id);
        stmt.stepForWrite();
      });
    }
    public async updateViewShared(viewId: RowId, isPrivate: boolean): Promise<void> {
      this.withSqliteStatement(`UPDATE ${tableName.views} SET private=? WHERE Id=? `, (stmt) => {
        stmt.bindBoolean(1, isPrivate);
        stmt.bindInteger(2, viewId);
        stmt.stepForWrite();
      });
    }
    public async updateViewJson(viewId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.views, viewId, json);
    }
    public async updateViewGroupJson(groupId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.viewGroups, groupId, json);
    }
    public async updateModelSelectorJson(modelSelectorId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.modelSelectors, modelSelectorId, json);
    }
    public async updateCategorySelectorJson(categorySelectorId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.categorySelectors, categorySelectorId, json);
    }
    public async updateDisplayStyleJson(styleId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.displayStyles, styleId, json);
    }
    public async updateTimelineJson(timelineId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.timelines, timelineId, json);
    }
    public async updateSearchJson(searchId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.searches, searchId, json);
    }
    private async updateName(table: string, id: RowId, name?: string): Promise<void> {
      this.withSqliteStatement(`UPDATE ${table} SET name=? WHERE Id=? `, (stmt) => {
        stmt.maybeBindString(1, name);
        stmt.bindInteger(2, id);
        stmt.stepForWrite();
      });
    }
    public async updateViewName(viewId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.views, viewId, name);
    }
    public async updateViewGroupName(groupId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.viewGroups, groupId, name);
    }
    public async updateModelSelectorName(selectorId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.modelSelectors, selectorId, name);
    }
    public async updateCategorySelectorName(selectorId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.categorySelectors, selectorId, name);
    }
    public async updateDisplayStyleName(styleId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.displayStyles, styleId, name);
    }
    public async updateTimelineName(timelineId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.timelines, timelineId, name);
    }
    public async updateSearchName(searchId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.searches, searchId, name);
    }
    public addTagToView(args: { viewId: RowId, tagId: RowId }) {
      this.withSqliteStatement(`INSERT OR IGNORE INTO ${tableName.taggedViews} (viewId, tagId) VALUES(?,?)`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        stmt.stepForWrite();
      });
    }
    public deleteViewTag(args: { viewId: RowId, tagId: RowId }): void {
      this.withSqliteStatement(`DELETE FROM ${tableName.taggedViews} WHERE viewId=? AND tagId=? `, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        stmt.stepForWrite();
      });
    }
    public findViewsForTag(tagId: RowId): RowId[] {
      return this.withSqliteStatement(`SELECT viewId FROM ${tableName.taggedViews} WHERE tagId=? `, (stmt) => {
        stmt.bindInteger(1, tagId);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }
    private findByName(table: string, name: string): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${table} WHERE name=? `, (stmt) => {
        stmt.bindString(1, name);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public getViewGroupByName(name: string, parentId: RowId): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.viewGroups} WHERE name=? AND parent=? `, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, parentId);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public findModelSelectorByName(name: string): RowId {
      return this.findByName(tableName.modelSelectors, name);
    }
    public findCategorySelectorByName(name: string): RowId {
      return this.findByName(tableName.categorySelectors, name);
    }
    public findDisplayStyleByName(name: string): RowId {
      return this.findByName(tableName.displayStyles, name);
    }
    public findTagByName(name: string): RowId {
      return this.findByName(tableName.tags, name);
    }
    public findTimelineByName(name: string): RowId {
      return this.findByName(tableName.timelines, name);
    }
    public findSearchByName(name: string): RowId {
      return this.findByName(tableName.searches, name);
    }

    public async findViewsByOwner(args: { owner: string }): Promise<RowString[]> {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE owner=? ORDER BY Id ASC`, (stmt) => {
        stmt.bindString(1, args.owner);
        const list: RowString[] = [];
        while (stmt.nextRow())
          list.push(tableRowIdToString(stmt.getValueInteger(0)));
        return list;
      });
    }
    public findViewsByClass(className: string[]): RowId[] {
      if (className.length === 0)
        return [];
      const sql = `SELECT Id FROM ${tableName.views} WHERE className IN(${className.map(() => "?").join(",")}) ORDER BY Id ASC`;
      return this.withSqliteStatement(sql, (stmt) => {
        for (let i = 0; i < className.length; ++i)
          stmt.bindString(i + 1, className[i]);

        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }
    public findTagsForView(viewId: RowId): RowId[] {
      return this.withSqliteStatement(`SELECT tagId FROM ${tableName.taggedViews} WHERE viewId=? `, (stmt) => {
        stmt.bindInteger(1, viewId);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }

    private toGuidRow(id?: Id64String): RowId | undefined {
      if (undefined === id)
        return undefined;
      const fedGuid = this.elements.getFederationGuidFromId(id);
      return fedGuid ? this.addGuid(fedGuid) : undefined;
    }
    private toCompressedGuidRows(ids: Id64String[] | string): CompressedId64Set {
      const result = new Set<Id64String>();
      for (const id of (typeof ids === "string" ? CompressedId64Set.iterable(ids) : ids)) {
        const guidRow = this.toGuidRow(id);
        if (undefined !== guidRow)
          result.add(Id64.fromLocalAndBriefcaseIds(guidRow, 0));
      }
      return CompressedId64Set.compressSet(result);
    }
    private fromGuidRow(guidRow: RowId): Id64String | undefined {
      return this.elements.getIdFromFederationGuid(this.getGuid(guidRow));
    }
    private fromGuidRowString(id?: string) {
      return (typeof id !== "string" || !id.startsWith("^")) ? id : this.fromGuidRow(rowIdFromString(id));
    }
    private fromCompressedGuidRows(guidRows: CompressedId64Set): CompressedId64Set {
      const result = new Set<Id64String>();
      for (const rowId64String of CompressedId64Set.iterable(guidRows)) {
        const elId = this.fromGuidRow(Id64.getLocalId(rowId64String));
        if (undefined !== elId)
          result.add(elId);
      }
      return CompressedId64Set.compressSet(result);
    }
    private toGuidRowMember(base: any, memberName: string) {
      const id = base?.[memberName];
      if (id === undefined)
        return;
      if (typeof id === "string" && Id64.isValidId64(id)) {
        const guidRow = this.toGuidRow(id);
        if (undefined !== guidRow) {
          base[memberName] = guidRowToString(guidRow);
          return;
        }
      }
      throw new Error(`invalid ${memberName}: ${id} `);
    }

    private fromGuidRowMember(base: any, memberName: string) {
      const id = base?.[memberName];
      if (id === undefined)
        return;
      if (typeof id === "string" && id.startsWith("^")) {
        const elId = this.fromGuidRow(rowIdFromString(id));
        if (undefined !== elId) {
          base[memberName] = elId;
          return;
        }
      }
      throw new Error(`invalid ${memberName}: ${id} `);
    }

    private verifyRowId(table: string, rowIdString: RowString): RowId {
      try {
        const rowId = rowIdFromString(rowIdString);
        this.withSqliteStatement(`SELECT 1 FROM ${table} WHERE Id=? `, (stmt) => {
          stmt.bindInteger(1, rowId);
          if (!stmt.nextRow())
            throw new Error(`missing: ${rowIdString} `);
        });
        return rowId;
      } catch (err: any) {
        throw new Error(`invalid Id for ${table}: ${err.message} `);
      }
    }
    private scriptToGuids(script: RenderSchedule.ScriptProps): RenderSchedule.ScriptProps {
      const scriptProps: RenderSchedule.ScriptProps = [];
      for (const model of script) {
        const modelGuidRow = this.toGuidRow(model.modelId);
        if (modelGuidRow) {
          model.modelId = guidRowToString(modelGuidRow);
          scriptProps.push(model);
          for (const batch of model.elementTimelines)
            batch.elementIds = this.toCompressedGuidRows(batch.elementIds);
        }
      }
      return scriptProps;
    }
    private scriptFromGuids(script: RenderSchedule.ScriptProps, omitElementIds: boolean): RenderSchedule.ScriptProps {
      const scriptProps: RenderSchedule.ScriptProps = [];
      for (const model of script) {
        const modelId = this.fromGuidRow(rowIdFromString(model.modelId));
        if (modelId) {
          model.modelId = modelId;
          scriptProps.push(model);
          for (const batch of model.elementTimelines) {
            if (undefined !== batch.elementIds)
              batch.elementIds = omitElementIds ? "" : this.fromCompressedGuidRows(batch.elementIds as CompressedId64Set);
          }
        }
      }
      return scriptProps;
    }

    public async addViewGroup(args: { name: string, parentId?: RowString, owner?: string }): Promise<RowString> {
      const parentId = args.parentId ? this.findViewGroup(args.parentId) : defaultViewGroupId;
      const json = JSON.stringify({});
      return tableRowIdToString(this.addViewGroupRow({ name: args.name, parentId, json, owner: args.owner }));
    }
    public async getViewGroups(args: { parent?: ViewGroupSpec }) {
      const parentIdRow = args.parent ? this.findViewGroup(args.parent) : defaultViewGroupId;
      const groups: { id: string, name: string }[] = [];
      this.withSqliteStatement(`SELECT Id,Name FROM ${tableName.viewGroups} WHERE ParentId=?`, (stmt) => {
        stmt.bindInteger(1, parentIdRow);
        while (stmt.nextRow()) {
          const id = stmt.getValueInteger(0);
          if (id !== defaultViewGroupId) // don't include root group
            groups.push({ id: tableRowIdToString(id), name: stmt.getValueString(1) });
        }
      });
      return groups;
    }

    public async addCategorySelector(args: { name?: string, categories: Id64Array, owner?: string }): Promise<RowString> {
      if (args.categories.length === 0)
        throw new Error("Must specify at least one category");

      const json = JSON.stringify({ categories: this.toCompressedGuidRows(args.categories) });
      return tableRowIdToString(this.addCategorySelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public loadCategorySelectorSync(args: { id: RowString }): CategorySelectorProps {
      const row = this.getCategorySelector(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("CategorySelector not found");

      const props = blankElementProps({}, "BisCore:CategorySelector", args.id, row.name) as CategorySelectorProps;
      const json = JSON.parse(row.json);
      props.categories = CompressedId64Set.decompressArray(this.fromCompressedGuidRows(json.categories));
      return props;
    }
    public async loadCategorySelector(args: { id: RowString }): Promise<CategorySelectorProps> {
      return this.loadCategorySelectorSync(args);
    }

    public async addModelSelector(args: { name?: string, models: Id64Array, owner?: string }): Promise<RowString> {
      if (args.models.length === 0)
        throw new Error("Must specify at least one model");

      const json = JSON.stringify({ models: this.toCompressedGuidRows(args.models) });
      return tableRowIdToString(this.addModelSelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public loadModelSelectorSync(args: { id: RowString }): ModelSelectorProps {
      const row = this.getModelSelector(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("ModelSelector not found");

      const props = blankElementProps({}, "BisCore:ModelSelector", args.id, row?.name) as ModelSelectorProps;
      const json = JSON.parse(row.json);
      props.models = CompressedId64Set.decompressArray(this.fromCompressedGuidRows(json.models));
      return props;
    }
    public async loadModelSelector(args: { id: RowString }): Promise<ModelSelectorProps> {
      return this.loadModelSelectorSync(args);
    }
    public async addTimeline(args: { name?: string, timeline: RenderSchedule.ScriptProps, owner?: string }): Promise<RowString> {
      const timeline = JSON.parse(JSON.stringify(args.timeline));
      if (!Array.isArray(timeline))
        throw new Error("Timeline has no entries");

      const json = JSON.stringify(this.scriptToGuids(timeline));
      return tableRowIdToString(this.addTimelineRow({ name: args.name, owner: args.owner, json }));
    }

    public loadTimelineSync(args: { id: RowString }): RenderTimelineProps {
      const row = this.getTimelineRow(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("Timeline not found");

      const props = blankElementProps({}, "BisCore:RenderTimeline", args.id, row?.name) as RenderTimelineProps;
      props.script = JSON.stringify(this.scriptFromGuids(JSON.parse(row.json), false));
      return props;
    }
    public async loadTimeline(args: { id: RowString }): Promise<RenderTimelineProps> {
      return this.loadTimelineSync(args);
    }

    /** add a DisplayStyleProps to the ViewStore */
    public async addDisplayStyle(args: { name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: string }): Promise<RowString> {
      const settings = JSON.parse(JSON.stringify(args.settings)) as DisplayStyleSettingsProps; // make a copy
      const name = args.name;
      if (settings.subCategoryOvr) {
        const outOvr: DisplayStyleSubCategoryProps[] = [];
        for (const ovr of settings.subCategoryOvr) {
          const subCategoryGuidRow = this.toGuidRow(ovr.subCategory);
          if (subCategoryGuidRow) {
            ovr.subCategory = guidRowToString(subCategoryGuidRow);
            outOvr.push(ovr);
          }
        }
        settings.subCategoryOvr = outOvr;
      }

      if (settings.excludedElements)
        settings.excludedElements = this.toCompressedGuidRows(settings.excludedElements);

      const settings3d = settings as DisplayStyle3dSettingsProps;
      if (settings3d.planProjections) {
        const planProjections = {} as { [modelId: string]: PlanProjectionSettingsProps };
        for (const entry of Object.entries(settings3d.planProjections)) {
          const modelGuidRow = this.toGuidRow(entry[0]);
          if (modelGuidRow)
            planProjections[guidRowToString(modelGuidRow)] = entry[1];
        }
        settings3d.planProjections = planProjections;
      }

      if (settings.renderTimeline) {
        if (!isViewStoreId(settings.renderTimeline))
          this.toGuidRowMember(settings, "renderTimeline");
        delete settings.scheduleScript;
      } else if (settings.scheduleScript) {
        const scriptProps = this.scriptToGuids(settings.scheduleScript);
        if (scriptProps.length > 0)
          settings.scheduleScript = scriptProps;
      }

      return tableRowIdToString(this.addDisplayStyleRow({ name, owner: args.owner, json: JSON.stringify({ settings, className: args.className }) }));
    }

    public loadDisplayStyleSync(args: { id: RowString, opts?: DisplayStyleLoadProps }): DisplayStyleProps {
      const row = this.getDisplayStyle(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("DisplayStyle not found");

      const val = JSON.parse(row.json) as { settings: DisplayStyle3dSettingsProps, className: string };
      const props = blankElementProps({}, val.className, args.id, row.name);
      props.jsonProperties = { styles: val.settings };
      const settings = val.settings;
      if (settings.subCategoryOvr) {
        const subCatOvr: DisplayStyleSubCategoryProps[] = [];
        for (const ovr of settings.subCategoryOvr) {
          const id = this.fromGuidRowString(ovr.subCategory);
          if (undefined !== id) {
            ovr.subCategory = id;
            subCatOvr.push(ovr);
          }
        }
        settings.subCategoryOvr = subCatOvr;
      }

      if (settings.excludedElements)
        settings.excludedElements = this.fromCompressedGuidRows(settings.excludedElements as CompressedId64Set);

      const settings3d = settings;
      if (settings3d.planProjections) {
        const planProjections = {} as { [modelId: string]: PlanProjectionSettingsProps };
        for (const entry of Object.entries(settings3d.planProjections)) {
          const modelId = this.fromGuidRowString(entry[0]);
          if (undefined !== modelId)
            planProjections[modelId] = entry[1];
        }
        settings3d.planProjections = planProjections;
      }

      if (isGuidRowString(settings.renderTimeline))
        settings.renderTimeline = this.fromGuidRowString(settings.renderTimeline);

      if (undefined !== settings.renderTimeline) {
        delete settings.scheduleScript;
      } else if (settings.scheduleScript) {
        delete settings.renderTimeline;
        settings.scheduleScript = this.scriptFromGuids(settings.scheduleScript, args.opts?.omitScheduleScriptElementIds === true);
      }

      return props;
    }

    public async loadDisplayStyle(args: { id: RowString, opts?: DisplayStyleLoadProps }): Promise<DisplayStyleProps> {
      return this.loadDisplayStyleSync(args);
    }

    public addViewDefinition(args: { viewDefinition: ViewDefinitionProps, group?: ViewGroupSpec, owner?: string, isPrivate?: boolean }): RowId {
      const viewDef = JSON.parse(JSON.stringify(args.viewDefinition)) as ViewDefinitionProps; // make a copy
      const name = viewDef.code.value;
      if (name === undefined)
        throw new Error("ViewDefinition must have a name");

      this.verifyRowId(tableName.categorySelectors, viewDef.categorySelectorId);
      this.verifyRowId(tableName.displayStyles, viewDef.displayStyleId);
      if ((viewDef as SpatialViewDefinitionProps).modelSelectorId)
        this.verifyRowId(tableName.modelSelectors, (viewDef as SpatialViewDefinitionProps).modelSelectorId);

      this.toGuidRowMember(viewDef, "baseModelId");
      this.toGuidRowMember(viewDef.jsonProperties?.viewDetails, "acs");
      const groupId = args.group ? this.findViewGroup(args.group) : defaultViewGroupId;
      const maybeRow = (rowString: RowString) => rowString ? rowIdFromString(rowString) : undefined;

      return this.addViewRow({
        name,
        className: viewDef.classFullName,
        owner: args.owner,
        groupId,
        isPrivate: args.isPrivate,
        json: stringifyProps(viewDef),
        modelSel: maybeRow((viewDef as SpatialViewDefinitionProps).modelSelectorId),
        categorySel: maybeRow(viewDef.categorySelectorId),
        displayStyle: maybeRow(viewDef.displayStyleId),
      });
    }

    public loadViewDefinitionSync(args: { id: RowString }): ViewDefinitionProps {
      const row = this.getViewRow(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("View not found");

      const props = blankElementProps(JSON.parse(row.json), row.className, args.id, row.name) as ViewDefinitionProps;
      this.fromGuidRowMember(props, "baseModelId");
      this.fromGuidRowMember(props.jsonProperties?.viewDetails, "acs");
      return props;
    }
    public async loadViewDefinition(args: { id: RowString }): Promise<ViewDefinitionProps> {
      return this.loadViewDefinitionSync(args);
    }

    public async addOrReplaceThumbnail(args: { viewId: ViewStoreIdString, thumbnail: ThumbnailProps, owner?: string }) {
      const viewRow = this.getViewRow(rowIdFromString(args.viewId));
      if (viewRow === undefined)
        throw new Error("View not found");
      const format: ThumbnailFormatProps = { format: args.thumbnail.format, height: args.thumbnail.height, width: args.thumbnail.width };
      return tableRowIdToString(this.addOrReplaceThumbnailRow({ data: args.thumbnail.image, viewId: rowIdFromString(args.viewId), format, owner: args.owner }));
    }

    public loadThumbnailSync(args: { viewId: RowString }): ThumbnailProps | undefined {
      const row = this.getThumbnailRow(rowIdFromString(args.viewId));
      return row ? { image: row.data, format: row.format.format, height: row.format.height, width: row.format.width } : undefined;
    }
    public async loadThumbnail(args: { viewId: RowString }): Promise<ThumbnailProps | undefined> {
      return this.loadThumbnailSync(args);
    }
    // find a group with the specified name using path syntax (e.g., "group1/design/issues"). If the group does not exist, return 0.
    // If groupName starts with "@", then it is considered to be a group id and this function verifies that it exists and throws if it does not.
    public findViewGroup(groupName: ViewGroupSpec): RowId {
      // if it starts with "@", then it is a group id
      if (groupName.startsWith("@"))
        return this.verifyRowId(tableName.viewGroups, groupName);

      // split the name into parts using "/" as the separator
      const names = groupName.split("/");
      let groupId = 1; // start at root group
      for (const name of names) {
        if (name.length !== 0) {
          groupId = this.getViewGroupByName(name, groupId);
          if (groupId === 0)
            return 0;
        }
      }
      return groupId;
    }

    public findViewByName(arg: { name: string, groupId?: RowId }): RowId {
      let name = arg.name;
      let groupId = arg.groupId;
      if (groupId === undefined) {
        // find last "/" in name
        const slash = name.lastIndexOf("/");
        if (slash !== -1) {
          groupId = this.findViewGroup(name.slice(0, slash));
          name = name.slice(slash + 1);
        }
      }
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE name=? AND groupId=? `, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, groupId ?? defaultViewGroupId);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public getViewByName(arg: { name: ViewName, groupId?: RowId }): ViewRow | undefined {
      const id = this.findViewByName(arg);
      return id ? this.getViewRow(id) : undefined;
    }

    public getDefaultViewIdSync(args: { group?: ViewGroupSpec }): RowString | undefined {
      const groupId = args.group ? this.findViewGroup(args.group) : defaultViewGroupId;
      const groupRow = groupId ? this.getViewGroup(groupId) : undefined;
      if (groupRow === undefined)
        return undefined;
      const props = JSON.parse(groupRow.json) as ViewGroupProps;
      if (props.defaultViewId === undefined)
        return undefined;
      const viewRow = this.getViewRow(rowIdFromString(props.defaultViewId));
      return viewRow ? props.defaultViewId : undefined;
    }
    public async getDefaultViewId(args: { group?: ViewGroupSpec }): Promise<RowString | undefined> {
      return this.getDefaultViewIdSync(args);
    }

    public async changeDefaultViewId(args: { defaultView: ViewStoreIdString, group?: ViewGroupSpec }) {
      const groupId = args.group ? this.findViewGroup(args.group) : defaultViewGroupId;
      const viewRow = this.getViewRow(rowIdFromString(args.defaultView));
      if (viewRow === undefined)
        throw new Error("View not found");
      if (viewRow.groupId !== groupId)
        throw new Error("View is not in the specified group");
      const groupRow = this.getViewGroup(groupId);
      if (groupRow === undefined)
        throw new Error("View group not found");
      const props = JSON.parse(groupRow.json) as ViewGroupProps;
      props.defaultViewId = args.defaultView;
      groupRow.json = JSON.stringify(props);
      return this.updateViewGroupJson(groupId, groupRow.json);
    }

    public getTagsForView(viewId: RowId) {
      const tags: string[] = [];
      this.withPreparedSqliteStatement(`SELECT t.name FROM ${tableName.tags} t JOIN ${tableName.taggedViews} v ON t.Id = v.tagId WHERE v.viewId=? `, (stmt) => {
        stmt.bindInteger(1, viewId);
        while (stmt.nextRow())
          tags.push(stmt.getValueString(0));
      });
      return tags.length === 0 ? undefined : tags;
    }

    public iterateViewQuery(queryParams: ViewQueryParams, callback: (rowId: RowId, view: ViewListEntry) => void) {
      const groupId = queryParams.group ? this.findViewGroup(queryParams.group) : defaultViewGroupId;
      let sql = `SELECT Id,className,name,owner,groupId,private FROM ${tableName.views} WHERE groupId=? `;
      if (queryParams.owner)
        sql += " AND owner=@owner";
      else
        sql += " AND private!=1";
      if (queryParams.from) {
        if (queryParams.only !== false) {
          sql += ` AND className = '${queryParams.from}'`;
        } else {
          if (queryParams.from === "BisCore:DrawingViewDefinition")
            sql += ` AND className IN('BisCore:DrawingViewDefinition', 'BisCore:SheetViewDefinition')`;
          else if (queryParams.from === "BisCore:SpatialViewDefinition")
            sql += ` AND className IN('BisCore:OrthographicViewDefinition', 'BisCore:SpatialViewDefinition')`;
          else
            sql += ` AND className = '${queryParams.from}'`;
        }
      }
      if (queryParams.nameSearch)
        sql += ` AND name ${queryParams.nameCompare ?? "="} @name`;
      if (queryParams.tags)
        sql += ` AND Id IN(SELECT viewId FROM ${tableName.taggedViews} WHERE tagId IN(SELECT Id FROM ${tableName.tags} WHERE name IN(${queryParams.tags.map((tag) => `'${tag}'`).join(",")})))`;
      if (queryParams.limit)
        sql += ` LIMIT ${queryParams.limit} `;
      if (queryParams.offset)
        sql += ` OFFSET ${queryParams.offset} `;

      this.withSqliteStatement(sql, (stmt) => {
        stmt.bindInteger(1, groupId);
        if (queryParams.nameSearch)
          stmt.bindString("@name", queryParams.nameSearch);
        if (queryParams.owner)
          stmt.bindString("@owner", queryParams.owner);

        while (stmt.nextRow()) {
          const rowId = stmt.getValueInteger(0);
          callback(
            rowId,
            {
              id: tableRowIdToString(rowId),
              class: stmt.getValueString(1),
              name: stmt.getValueString(2),
              owner: stmt.getValueString(3),
              groupId: tableRowIdToString(stmt.getValueInteger(4)),
              isPrivate: stmt.getValueBoolean(5),
            });
        }
      });
    }

    public queryViewList(queryParams: ViewQueryParams): ViewListEntry[] {
      const entries: ViewListEntry[] = [];
      this.iterateViewQuery(queryParams, (rowId, entry) => {
        entry.tags = this.getTagsForView(rowId);
        entries.push(entry);
      });
      return entries;
    }

    public async addTagsToView(args: { viewId: RowString, tags: string[], owner?: string }) {
      const viewId = rowIdFromString(args.viewId);
      for (const tag of args.tags) {
        let tagId = this.findTagByName(tag);
        if (tagId === 0)
          tagId = this.addTag({ name: tag, owner: args.owner, json: "{}" });
        this.addTagToView({ viewId, tagId });
      }
    }
    public async removeTagFromView(args: { viewId: RowString, tag: string }) {
      const viewId = rowIdFromString(args.viewId);
      const tagId = this.findTagByName(args.tag);
      if (tagId !== 0)
        this.deleteViewTag({ viewId, tagId });
    }

    public async addView(args: AddViewArgs): Promise<RowString> {
      const owner = args.owner;
      if (args.viewDefinition.categorySelectorId) {
        this.verifyRowId(tableName.categorySelectors, args.viewDefinition.categorySelectorId);
      } else {
        if (args.categorySelectorProps === undefined)
          throw new Error("Must supply categorySelector");
        args.viewDefinition.categorySelectorId = await this.addCategorySelector({ categories: args.categorySelectorProps.categories, owner });
      }
      const spatialDef = args.viewDefinition as SpatialViewDefinitionProps;
      if (spatialDef.modelSelectorId) {
        this.verifyRowId(tableName.modelSelectors, spatialDef.modelSelectorId);
      } else if (args.modelSelectorProps) {
        spatialDef.modelSelectorId = await this.addModelSelector({ models: args.modelSelectorProps.models, owner });
      } else if (args.viewDefinition.classFullName === "BisCore:SpatialViewDefinition") {
        throw new Error("Must supply modelSelector for Spatial views");
      }
      if (spatialDef.displayStyleId) {
        this.verifyRowId(tableName.displayStyles, spatialDef.displayStyleId);
      } else {
        if (args.displayStyleProps === undefined || args.displayStyleProps.jsonProperties?.styles === undefined)
          throw new Error("Must supply valid displayStyle");
        spatialDef.displayStyleId = await this.addDisplayStyle({ className: args.displayStyleProps.classFullName, settings: args.displayStyleProps.jsonProperties.styles, owner });
      }
      const viewId = tableRowIdToString(this.addViewDefinition(args));
      if (args.tags)
        await this.addTagsToView({ viewId, tags: args.tags, owner });

      return viewId;
    }

    public async deleteView(viewId: RowString) {
      const rowId = rowIdFromString(viewId);
      const viewRow = this.getViewRow(rowId);
      if (viewRow === undefined)
        throw new Error("View not found");

      this.deleteViewRow(rowId);
      const hasName = (table: string, nameRow: RowId) => {
        const name = this.withSqliteStatement(`SELECT name FROM ${table} WHERE Id=?`, (stmt) => {
          stmt.bindInteger(1, nameRow);
          return stmt.nextRow() ? stmt.getValueString(0) : undefined;
        });
        return name !== undefined && name?.length > 0;
      };
      const tryDelete = (table: string, id?: RowId) => {
        if (id !== undefined && !hasName(table, id)) { // only delete if the row has no name
          try {
            this.deleteFromTable(table, id);
          } catch (err) {
            // ignore constraint error if the row is still referenced by another view
          }
        }
      };

      // delete any selectors or display styles that are no longer referenced
      tryDelete(tableName.categorySelectors, viewRow.categorySel);
      tryDelete(tableName.modelSelectors, viewRow.modelSel);
      tryDelete(tableName.displayStyles, viewRow.displayStyle);
    }
  }

  const viewDbName = "ViewDb" as const;

  export interface ReadViewStoreMethods extends ReadViewStoreRpc {
    findViewsByClass(className: string[]): RowId[];
    getDefaultViewIdSync(args: { group?: ViewGroupSpec }): RowString | undefined;
    getViewByName(arg: { name: ViewName, groupId?: RowId }): ViewRow | undefined;
    loadCategorySelectorSync(args: { id: RowString }): CategorySelectorProps;
    loadDisplayStyleSync(args: { id: RowString, opts?: DisplayStyleLoadProps }): DisplayStyleProps;
    loadModelSelectorSync(args: { id: RowString }): ModelSelectorProps;
    loadThumbnailSync(args: { viewId: RowString }): ThumbnailProps | undefined;
    loadViewDefinitionSync(args: { id: RowString }): ViewDefinitionProps;
    queryViewList(queryParams: ViewQueryParams): ViewListEntry[];
  }

  /** Provides access to a cloud-based `ViewDb` */
  export class CloudAccess extends CloudSqlite.DbAccess<ViewDb, ReadViewStoreMethods, WriteViewStoreRpc> {
    public constructor(props: CloudSqlite.ContainerAccessProps & { elements?: IModelDb.GuidMapper }) {
      super({ dbType: ViewDb, props, dbName: viewDbName });
    }

    /** Initialize a cloud container for use as a ViewDb. */
    public static async initializeDb(props: CloudSqlite.ContainerAccessProps) {
      return super._initializeDb({ props, dbType: ViewDb, dbName: viewDbName });
    }
  }
}
