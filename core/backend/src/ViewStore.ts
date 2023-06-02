/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { CompressedId64Set, GuidString, Id64, Id64Array, Id64String, MarkRequired, Optional } from "@itwin/core-bentley";
import {
  CategorySelectorProps, DisplayStyle3dSettingsProps, DisplayStyleLoadProps, DisplayStyleProps, DisplayStyleSettingsProps,
  DisplayStyleSubCategoryProps, ElementProps, IModel, isViewStoreId, ModelSelectorProps, PlanProjectionSettingsProps, RenderSchedule,
  RenderTimelineProps, SpatialViewDefinitionProps, ThumbnailFormatProps, ThumbnailProps, ViewDefinitionProps,
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
 * views must have a name that is unique within the ViewGroup. The root ViewGroup is named "Root" and has a RowId of 1. The root ViewGroup can not be deleted.
 * ViewGroups are stored in the "viewGroups" table.
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
    groups: "viewGroups",
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
    shared?: boolean;
  }

  /** a row in the "viewGroups" table */
  export interface ViewGroupRow extends Optional<TableRow, "json"> {
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

  export const defaultViewGroupId = 1 as const;

  export class ViewDb extends VersionedSqliteDb {
    public override myVersion = "4.0.0";

    /** create all the tables for a new ViewDb */
    protected override createDDL() {
      const baseCols = "Id INTEGER PRIMARY KEY,json TEXT,owner TEXT";
      this.createTable({
        tableName: tableName.views,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,className TEXT NOT NULL,shared BOOLEAN,groupId INTEGER NOT NULL REFERENCES ${tableName.groups}(Id) ON DELETE CASCADE`,
        constraints: "UNIQUE(groupId,name)",
        addTimestamp: true,
      });

      // for tables that have a "name" column, we want to enforce case-insensitive uniqueness. Names may be null.
      const makeTable = (table: string, extra?: string) => {
        this.createTable({ tableName: table, columns: `${baseCols},name TEXT UNIQUE COLLATE NOCASE${extra ?? ""}`, addTimestamp: true });
      };

      makeTable(tableName.groups, `,parent INTEGER NOT NULL REFERENCES ${tableName.groups}(Id) ON DELETE CASCADE`);
      makeTable(tableName.modelSelectors);
      makeTable(tableName.categorySelectors);
      makeTable(tableName.displayStyles);
      makeTable(tableName.timelines);
      makeTable(tableName.tags);
      makeTable(tableName.searches);
      this.createTable({ tableName: tableName.thumbnails, columns: `Id INTEGER PRIMARY KEY REFERENCES ${tableName.views}(Id) ON DELETE CASCADE,json,owner,data BLOB NOT NULL` });
      this.createTable({
        tableName: tableName.taggedViews, columns: `viewId NOT NULL REFERENCES ${tableName.views}(Id) ON DELETE CASCADE,tagId NOT NULL REFERENCES ${tableName.tags}(Id) ON DELETE CASCADE`,
      });
      this.createTable({ tableName: tableName.guids, columns: `guid BLOB NOT NULL UNIQUE` });
      this.addViewGroupRow({ name: "Root" });
    }

    /** get the row in the "guids" table for a given guid. If the guid is not present, return 0 */
    private getGuidRow(guid: GuidString): RowId {
      return this.withPreparedSqliteStatement(`SELECT rowId FROM ${tableName.guids} WHERE guid=?`, (stmt) => {
        stmt.bindGuid(1, guid);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public getGuid(rowid: RowId): GuidString | undefined {
      return this.withSqliteStatement(`SELECT guid FROM ${tableName.guids} WHERE rowId=?`, (stmt) => {
        stmt.bindInteger(1, rowid);
        return !stmt.nextRow() ? undefined : stmt.getValueGuid(0);
      });
    }
    /** @internal */
    public iterateGuids(rowIds: RowId[], fn: (guid: GuidString, row: RowId) => void) {
      this.withSqliteStatement(`SELECT guid FROM ${tableName.guids} WHERE rowId=?`, (stmt) => {
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
      return existing !== 0 ? existing : this.withPreparedSqliteStatement(`INSERT INTO ${tableName.guids}(guid) VALUES (?)`, (stmt) => {
        stmt.bindGuid(1, guid);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    /** @internal */
    public addViewRow(args: ViewRow): RowId {
      return this.withSqliteStatement(`INSERT INTO ${tableName.views}(className,name,json,owner,shared,groupId) VALUES (?,?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        stmt.maybeBindBoolean(5, args.shared);
        stmt.bindInteger(6, args.groupId ?? 1);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    /** @internal */
    public addViewGroupRow(args: Optional<ViewGroupRow, "parentId">): RowId {
      return this.withSqliteStatement(`INSERT INTO ${tableName.groups}(name,owner,parent,json) VALUES (?,?,?,?)`, (stmt) => {
        stmt.maybeBindString(1, args.name);
        stmt.maybeBindString(2, args.owner);
        stmt.bindInteger(3, args.parentId ?? 1);
        stmt.maybeBindString(4, args.json);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    private addTableRow(table: string, args: TableRow): RowId {
      return this.withSqliteStatement(`INSERT INTO ${table}(name,json,owner) VALUES (?,?,?)`, (stmt) => {
        stmt.maybeBindString(1, args.name);
        stmt.bindString(2, args.json);
        stmt.maybeBindString(3, args.owner);
        this.stepForWrite(stmt);
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
    public async addTag(args: TagRow): Promise<RowId> {
      return this.addTableRow(tableName.tags, args);
    }
    /** add a row to the "searches" table, return the RowId */
    public async addSearch(args: SearchRow): Promise<RowId> {
      return this.addTableRow(tableName.searches, args);
    }
    /** add a ViewGroup to the "viewGroups" table, return the RowId */
    public async addViewGroup(args: ViewGroupRow): Promise<RowId> {
      return this.addViewGroupRow(args);
    }

    /** add or update a row in the "thumbnails" table, return the RowId */
    public addOrReplaceThumbnailRow(args: ThumbnailRow): RowId {
      return this.withSqliteStatement(`INSERT OR REPLACE INTO ${tableName.thumbnails}(Id,json,owner,data) VALUES (?,?,?,?)`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindString(2, JSON.stringify(args.format));
        stmt.maybeBindString(3, args.owner);
        stmt.bindBlob(4, args.data);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    private deleteFromTable(table: string, id: RowId): void {
      this.withSqliteStatement(`DELETE FROM ${table} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        this.stepForWrite(stmt);
      });
    }
    public async deleteView(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.views, id);
    }
    public async deleteViewGroup(id: RowId): Promise<void> {
      if (id === 1)
        throw new Error("Cannot delete root group");
      return this.deleteFromTable(tableName.groups, id);
    }
    public async deleteModelSelector(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.modelSelectors, id);
    }
    public async deleteCategorySelector(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.categorySelectors, id);
    }
    public async deleteDisplayStyle(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.displayStyles, id);
    }
    public async deleteTimeline(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.timelines, id);
    }
    public async deleteTag(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.tags, id);
    }
    public async deleteSearch(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.searches, id);
    }
    public async deleteThumbnail(id: RowId): Promise<void> {
      return this.deleteFromTable(tableName.thumbnails, id);
    }
    /** get the data for a view from the database */
    public getViewRow(viewId: RowId): undefined | Omit<ViewRow, "thumbnail"> {
      return this.withSqliteStatement(`SELECT className,name,json,owner,shared,groupId FROM ${tableName.views} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
          shared: stmt.getValueBoolean(4),
          groupId: stmt.getValueInteger(5),
        };
      });
    }
    public getThumbnailRow(viewId: RowId): undefined | ThumbnailRow {
      return this.withSqliteStatement(`SELECT json,owner,data FROM ${tableName.thumbnails} WHERE Id=?`, (stmt) => {
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
      return this.withSqliteStatement(`SELECT name,owner,json,parent FROM ${tableName.groups} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          name: stmt.getValueStringMaybe(0),
          owner: stmt.getValueStringMaybe(1),
          json: stmt.getValueString(2),
          parentId: stmt.getValueInteger(3),
        };
      });
    }
    private getTableRow(table: string, id: RowId): SelectorRow | undefined {
      return this.withSqliteStatement(`SELECT name,json,owner FROM ${table} WHERE Id=?`, (stmt) => {
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
      this.withSqliteStatement(`UPDATE ${table} SET json=? WHERE Id=?`, (stmt) => {
        stmt.bindString(1, json);
        stmt.bindInteger(2, id);
        this.stepForWrite(stmt);
      });
    }
    public async updateViewShared(viewId: RowId, shared: boolean): Promise<void> {
      this.withSqliteStatement(`UPDATE ${tableName.views} SET shared=? WHERE Id=?`, (stmt) => {
        stmt.bindBoolean(1, shared);
        stmt.bindInteger(2, viewId);
        this.stepForWrite(stmt);
      });
    }
    public async updateViewJson(viewId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.views, viewId, json);
    }
    public async updateViewGroupJson(groupId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.groups, groupId, json);
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
      this.withSqliteStatement(`UPDATE ${table} SET name=? WHERE Id=?`, (stmt) => {
        stmt.maybeBindString(1, name);
        stmt.bindInteger(2, id);
        this.stepForWrite(stmt);
      });
    }
    public async updateViewName(viewId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.views, viewId, name);
    }
    public async updateViewGroupName(groupId: RowId, name?: string): Promise<void> {
      return this.updateName(tableName.groups, groupId, name);
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
    public async addTagToView(args: { viewId: RowId, tagId: RowId }): Promise<void> {
      this.withSqliteStatement(`INSERT INTO ${tableName.taggedViews}(viewId,tagId) VALUES (?,?)`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        this.stepForWrite(stmt);
      });
    }
    public async deleteViewTag(args: { viewId: RowId, tagId: RowId }): Promise<void> {
      this.withSqliteStatement(`DELETE FROM ${tableName.taggedViews} WHERE viewId=? AND tagId=?`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        this.stepForWrite(stmt);
      });
    }
    public async deleteAllTagsForView(viewId: RowId): Promise<void> {
      this.withSqliteStatement(`DELETE FROM ${tableName.taggedViews} WHERE viewId=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        this.stepForWrite(stmt);
      });
    }
    public async deleteAllTaggedViews(tagId: RowId): Promise<void> {
      this.withSqliteStatement(`DELETE FROM ${tableName.taggedViews} WHERE tagId=?`, (stmt) => {
        stmt.bindInteger(1, tagId);
        this.stepForWrite(stmt);
      });
    }
    public findViewsForTag(tagId: RowId): RowId[] {
      return this.withSqliteStatement(`SELECT viewId FROM ${tableName.taggedViews} WHERE tagId=?`, (stmt) => {
        stmt.bindInteger(1, tagId);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }
    public findViewByName(name: string, groupId: RowId): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE name=? AND groupId=?`, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, groupId);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    private findByName(table: string, name: string): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${table} WHERE name=?`, (stmt) => {
        stmt.bindString(1, name);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public findViewGroupByName(name: string): RowId {
      return this.findByName(tableName.groups, name);
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
    public getViewByName(arg: { name: string, groupId?: RowId }): Omit<ViewRow, "thumbnail"> | undefined {
      const id = this.findViewByName(arg.name, arg.groupId ?? defaultViewGroupId);
      return id ? this.getViewRow(id) : undefined;
    }

    public findViewsByOwner(owner: string): RowId[] {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE owner=? ORDER BY Id ASC`, (stmt) => {
        stmt.bindString(1, owner);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }
    public findViewsByClass(className: string[]): RowId[] {
      if (className.length === 0)
        return [];
      const sql = `SELECT Id FROM ${tableName.views} WHERE className IN (${className.map(() => "?").join(",")}) ORDER BY Id ASC`;
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
      return this.withSqliteStatement(`SELECT tagId FROM ${tableName.taggedViews} WHERE viewId=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }

    private toGuidRow(elements: IModelDb.GuidMapper, id?: Id64String): RowId | undefined {
      if (undefined === id)
        return undefined;
      const fedGuid = elements.getFederationGuidFromId(id);
      return fedGuid ? this.addGuid(fedGuid) : undefined;
    }
    private toCompressedGuidRows(elements: IModelDb.GuidMapper, ids: Id64String[] | string): CompressedId64Set {
      const result = new Set<Id64String>();
      for (const id of (typeof ids === "string" ? CompressedId64Set.iterable(ids) : ids)) {
        const guidRow = this.toGuidRow(elements, id);
        if (undefined !== guidRow)
          result.add(Id64.fromLocalAndBriefcaseIds(guidRow, 0));
      }
      return CompressedId64Set.compressSet(result);
    }
    private fromGuidRow(elements: IModelDb.GuidMapper, guidRow: RowId): Id64String | undefined {
      return elements.getIdFromFederationGuid(this.getGuid(guidRow));
    }
    private fromGuidRowString(elements: IModelDb.GuidMapper, id?: string) {
      return (typeof id !== "string" || !id.startsWith("^")) ? id : this.fromGuidRow(elements, rowIdFromString(id));
    }
    private fromCompressedGuidRows(elements: IModelDb.GuidMapper, guidRows: CompressedId64Set): CompressedId64Set {
      const result = new Set<Id64String>();
      for (const rowId64String of CompressedId64Set.iterable(guidRows)) {
        const elId = this.fromGuidRow(elements, Id64.getLocalId(rowId64String));
        if (undefined !== elId)
          result.add(elId);
      }
      return CompressedId64Set.compressSet(result);
    }
    private toGuidRowMember(elements: IModelDb.GuidMapper, base: any, memberName: string) {
      const id = base?.[memberName];
      if (id === undefined)
        return;
      if (typeof id === "string" && Id64.isValidId64(id)) {
        const guidRow = this.toGuidRow(elements, id);
        if (undefined !== guidRow) {
          base[memberName] = guidRowToString(guidRow);
          return;
        }
      }
      throw new Error(`invalid ${memberName}: ${id}`);
    }

    private fromGuidRowMember(elements: IModelDb.GuidMapper, base: any, memberName: string) {
      const id = base?.[memberName];
      if (id === undefined)
        return;
      if (typeof id === "string" && id.startsWith("^")) {
        const elId = this.fromGuidRow(elements, rowIdFromString(id));
        if (undefined !== elId) {
          base[memberName] = elId;
          return;
        }
      }
      throw new Error(`invalid ${memberName}: ${id}`);
    }

    private verifyRowId(table: string, rowIdString: RowString): void {
      try {
        const rowId = rowIdFromString(rowIdString);
        this.withSqliteStatement(`SELECT 1 FROM ${table} WHERE Id=?`, (stmt) => {
          stmt.bindInteger(1, rowId);
          if (!stmt.nextRow())
            throw new Error(`missing: ${rowIdString}`);
        });
      } catch (err: any) {
        throw new Error(`invalid Id for ${table}: ${err.message}`);
      }
    }
    private scriptToGuids(elements: IModelDb.GuidMapper, script: RenderSchedule.ScriptProps): RenderSchedule.ScriptProps {
      const scriptProps: RenderSchedule.ScriptProps = [];
      for (const model of script) {
        const modelGuidRow = this.toGuidRow(elements, model.modelId);
        if (modelGuidRow) {
          model.modelId = guidRowToString(modelGuidRow);
          scriptProps.push(model);
          for (const batch of model.elementTimelines)
            batch.elementIds = this.toCompressedGuidRows(elements, batch.elementIds);
        }
      }
      return scriptProps;
    }
    private scriptFromGuids(elements: IModelDb.GuidMapper, script: RenderSchedule.ScriptProps, omitElementIds: boolean): RenderSchedule.ScriptProps {
      const scriptProps: RenderSchedule.ScriptProps = [];
      for (const model of script) {
        const modelId = this.fromGuidRow(elements, rowIdFromString(model.modelId));
        if (modelId) {
          model.modelId = modelId;
          scriptProps.push(model);
          for (const batch of model.elementTimelines) {
            if (undefined !== batch.elementIds)
              batch.elementIds = omitElementIds ? "" : this.fromCompressedGuidRows(elements, batch.elementIds as CompressedId64Set);
          }
        }
      }
      return scriptProps;
    }

    public async addCategorySelector(args: { elements: IModelDb.GuidMapper, name?: string, categories: Id64Array, owner?: string }): Promise<RowString> {
      if (args.categories.length === 0)
        throw new Error("Must specify at least one category");

      const json = JSON.stringify({ categories: this.toCompressedGuidRows(args.elements, args.categories) });
      return tableRowIdToString(this.addCategorySelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public loadCategorySelector(args: { elements: IModelDb.GuidMapper, id: RowString }): CategorySelectorProps {
      const row = this.getCategorySelector(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("CategorySelector not found");

      const props = blankElementProps({}, "BisCore:CategorySelector", args.id, row.name) as CategorySelectorProps;
      const json = JSON.parse(row.json);
      props.categories = CompressedId64Set.decompressArray(this.fromCompressedGuidRows(args.elements, json.categories));
      return props;
    }

    public async addModelSelector(args: { elements: IModelDb.GuidMapper, name?: string, models: Id64Array, owner?: string }): Promise<RowString> {
      if (args.models.length === 0)
        throw new Error("Must specify at least one model");

      const json = JSON.stringify({ models: this.toCompressedGuidRows(args.elements, args.models) });
      return tableRowIdToString(this.addModelSelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public loadModelSelector(args: { elements: IModelDb.GuidMapper, id: RowString }): ModelSelectorProps {
      const row = this.getModelSelector(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("ModelSelector not found");

      const props = blankElementProps({}, "BisCore:ModelSelector", args.id, row?.name) as ModelSelectorProps;
      const json = JSON.parse(row.json);
      props.models = CompressedId64Set.decompressArray(this.fromCompressedGuidRows(args.elements, json.models));
      return props;
    }

    public async addTimeline(args: { elements: IModelDb.GuidMapper, name?: string, timeline: RenderSchedule.ScriptProps, owner?: string }): Promise<RowString> {
      const timeline = JSON.parse(JSON.stringify(args.timeline));
      if (!Array.isArray(timeline))
        throw new Error("Timeline has no entries");

      const json = JSON.stringify(this.scriptToGuids(args.elements, timeline));
      return tableRowIdToString(this.addTimelineRow({ name: args.name, owner: args.owner, json }));
    }

    public loadTimeline(args: { elements: IModelDb.GuidMapper, id: RowString }): RenderTimelineProps {
      const row = this.getTimelineRow(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("Timeline not found");

      const props = blankElementProps({}, "BisCore:RenderTimeline", args.id, row?.name) as RenderTimelineProps;
      props.script = JSON.stringify(this.scriptFromGuids(args.elements, JSON.parse(row.json), false));
      return props;
    }

    /** add a DisplayStyleProps to the ViewStore */
    public async addDisplayStyle(args: { elements: IModelDb.GuidMapper, name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: string }): Promise<RowString> {
      const settings = JSON.parse(JSON.stringify(args.settings)) as DisplayStyleSettingsProps; // make a copy
      const name = args.name;
      if (settings.subCategoryOvr) {
        const outOvr: DisplayStyleSubCategoryProps[] = [];
        for (const ovr of settings.subCategoryOvr) {
          const subCategoryGuidRow = this.toGuidRow(args.elements, ovr.subCategory);
          if (subCategoryGuidRow) {
            ovr.subCategory = guidRowToString(subCategoryGuidRow);
            outOvr.push(ovr);
          }
        }
        settings.subCategoryOvr = outOvr;
      }

      if (settings.excludedElements)
        settings.excludedElements = this.toCompressedGuidRows(args.elements, settings.excludedElements);

      const settings3d = settings as DisplayStyle3dSettingsProps;
      if (settings3d.planProjections) {
        const planProjections = {} as { [modelId: string]: PlanProjectionSettingsProps };
        for (const entry of Object.entries(settings3d.planProjections)) {
          const modelGuidRow = this.toGuidRow(args.elements, entry[0]);
          if (modelGuidRow)
            planProjections[guidRowToString(modelGuidRow)] = entry[1];
        }
        settings3d.planProjections = planProjections;
      }

      if (settings.renderTimeline) {
        if (!isViewStoreId(settings.renderTimeline))
          this.toGuidRowMember(args.elements, settings, "renderTimeline");
        delete settings.scheduleScript;
      } else if (settings.scheduleScript) {
        const scriptProps = this.scriptToGuids(args.elements, settings.scheduleScript);
        if (scriptProps.length > 0)
          settings.scheduleScript = scriptProps;
      }

      return tableRowIdToString(this.addDisplayStyleRow({ name, owner: args.owner, json: JSON.stringify({ settings, className: args.className }) }));
    }

    public loadDisplayStyle(args: { elements: IModelDb.GuidMapper, id: RowString, opts?: DisplayStyleLoadProps }): DisplayStyleProps {
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
          const id = this.fromGuidRowString(args.elements, ovr.subCategory);
          if (undefined !== id) {
            ovr.subCategory = id;
            subCatOvr.push(ovr);
          }
        }
        settings.subCategoryOvr = subCatOvr;
      }

      if (settings.excludedElements)
        settings.excludedElements = this.fromCompressedGuidRows(args.elements, settings.excludedElements as CompressedId64Set);

      const settings3d = settings;
      if (settings3d.planProjections) {
        const planProjections = {} as { [modelId: string]: PlanProjectionSettingsProps };
        for (const entry of Object.entries(settings3d.planProjections)) {
          const modelId = this.fromGuidRowString(args.elements, entry[0]);
          if (undefined !== modelId)
            planProjections[modelId] = entry[1];
        }
        settings3d.planProjections = planProjections;
      }

      if (isGuidRowString(settings.renderTimeline))
        settings.renderTimeline = this.fromGuidRowString(args.elements, settings.renderTimeline);

      if (undefined !== settings.renderTimeline) {
        delete settings.scheduleScript;
      } else if (settings.scheduleScript) {
        delete settings.renderTimeline;
        settings.scheduleScript = this.scriptFromGuids(args.elements, settings.scheduleScript, args.opts?.omitScheduleScriptElementIds === true);
      }

      return props;
    }

    public async addViewDefinition(args: { elements: IModelDb.GuidMapper, viewDefinition: ViewDefinitionProps, groupId?: RowId, owner?: string }): Promise<RowString> {
      const viewDef = JSON.parse(JSON.stringify(args.viewDefinition)) as ViewDefinitionProps; // make a copy
      const name = viewDef.code.value;
      if (name === undefined)
        throw new Error("ViewDefinition must have a name");

      this.verifyRowId(tableName.categorySelectors, viewDef.categorySelectorId);
      this.verifyRowId(tableName.displayStyles, viewDef.displayStyleId);
      if ((viewDef as SpatialViewDefinitionProps).modelSelectorId)
        this.verifyRowId(tableName.modelSelectors, (viewDef as SpatialViewDefinitionProps).modelSelectorId);

      this.toGuidRowMember(args.elements, viewDef, "baseModelId");
      this.toGuidRowMember(args.elements, viewDef.jsonProperties?.viewDetails, "acs");
      return tableRowIdToString(this.addViewRow({ name, className: viewDef.classFullName, owner: args.owner, groupId: args.groupId ?? defaultViewGroupId, json: stringifyProps(viewDef) }));
    }

    public loadViewDefinition(args: { elements: IModelDb.GuidMapper, id: RowString }): ViewDefinitionProps {
      const row = this.getViewRow(rowIdFromString(args.id));
      if (undefined === row)
        throw new Error("ViewDefinition not found");

      const props = blankElementProps(JSON.parse(row.json), row.className, args.id, row.name) as ViewDefinitionProps;
      this.fromGuidRowMember(args.elements, props, "baseModelId");
      this.fromGuidRowMember(args.elements, props.jsonProperties?.viewDetails, "acs");
      return props;
    }

    public async updateThumbnail(args: { viewId: RowString, thumbnail: ThumbnailProps }) {
      const format: ThumbnailFormatProps = { format: args.thumbnail.format, height: args.thumbnail.height, width: args.thumbnail.width };
      return this.addOrReplaceThumbnailRow({ data: args.thumbnail.image, viewId: rowIdFromString(args.viewId), format });
    }
    public loadThumbnail(viewId: RowString): ThumbnailProps | undefined {
      const row = this.getThumbnailRow(rowIdFromString(viewId));
      return row ? { image: row.data, format: row.format.format, height: row.format.height, width: row.format.width } : undefined;
    }
  }

  const viewDbName = "ViewDb" as const;

  /** Provides access to a cloud-based `ViewDb` */
  export class CloudAccess extends CloudSqlite.DbAccess<ViewDb> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: ViewDb, props, dbName: viewDbName });
    }

    /** Initialize a cloud container for use as a ViewDb. */
    public static async initializeDb(props: CloudSqlite.ContainerAccessProps) {
      return super._initializeDb({ props, dbType: ViewDb, dbName: viewDbName });
    }
  }

}
