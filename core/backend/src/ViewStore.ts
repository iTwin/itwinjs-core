/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { CompressedId64Set, GuidString, Id64, Id64Array, Id64String, Logger, MarkRequired, Optional } from "@itwin/core-bentley";
import {
  CategorySelectorProps, DisplayStyle3dSettingsProps, DisplayStyleLoadProps, DisplayStyleProps, DisplayStyleSettingsProps,
  DisplayStyleSubCategoryProps, ElementProps, IModel, ModelSelectorProps, PlanProjectionSettingsProps, RenderSchedule,
  RenderTimelineProps, SpatialViewDefinitionProps, ThumbnailFormatProps, ThumbnailProps, ViewDefinitionProps, ViewStoreRpc,
} from "@itwin/core-common";
import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";
import { SqliteStatement } from "./SqliteStatement";
import { IModelDb } from "./IModelDb";
import { Category } from "./Category";
import { Model } from "./Model";
import { Entity } from "./Entity";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

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
 * A IdString is a string that uniquely identifies a row in one of the ViewStore's internal tables. The string holds a base-36 integer
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
  type ThumbnailData = Uint8Array;

  /** A row in a table. 0 means "not present" */
  export type RowId = number;

  /** a string representation of a row in a table of a ViewStore. Will be a base-36 integer with a leading "@" (e.g."@4e3") */
  type RowString = string;

  /** a string representation of a row in the Guid table. Will be a base-36 integer with a leading "^" (e.g."^4e3") */
  type GuidRowString = string;

  /** common properties for all tables */
  interface TableRow {
    name?: string;
    json: string;
    owner?: string;
  }
  type DisplayStyleRow = TableRow;
  type SelectorRow = TableRow;
  type TagRow = TableRow;
  type SearchRow = TableRow;
  type TimelineRow = TableRow;

  /** a row in the "views" table */
  interface ViewRow extends MarkRequired<TableRow, "name"> {
    className: string;
    groupId: RowId;
    isPrivate?: boolean;
    modelSel?: RowId;
    categorySel: RowId;
    displayStyle: RowId;
  }

  /** a row in the "viewGroups" table  */
  interface ViewGroupRow extends MarkRequired<TableRow, "name"> {
    parentId: RowId;
    defaultViewId?: RowId;
  }

  /** a row in the "thumbnails" table */
  interface ThumbnailRow {
    viewId: RowId;
    data: ThumbnailData;
    format: ThumbnailFormatProps;
    owner?: string;
  }

  /** convert a RowId to a RowString (base-36 integer with a leading "@") */
  export const fromRowId = (rowId: RowId): RowString => {
    return `@${rowId.toString(36)}`;
  };
  /** convert a guid RowId to a GuidRowString (base-36 integer with a leading "^") */
  const guidRowToString = (rowId: RowId): GuidRowString => {
    return `^${rowId.toString(36)}`;
  };

  /** determine if a string is a guid row string (base-36 integer with a leading "^") */
  const isGuidRowString = (id?: string) => true === id?.startsWith("^");

  type RowIdOrString = RowId | RowString;

  /** @internal */
  export const toRowId = (id: RowIdOrString): RowId => {
    if (typeof id === "number")
      return id;

    if (!ViewStoreRpc.isViewStoreId(id) && !isGuidRowString(id))
      throw new Error(`invalid value: ${id}`);
    return parseInt(id.slice(1), 36);
  };

  const maybeToRowId = (id?: RowIdOrString) => undefined === id ? undefined : toRowId(id);
  const cloneProps = <T extends object>(from: T) => JSON.parse(JSON.stringify(from)) as T;

  const blankElementProps = (from: any, classFullName: string, idString: RowIdOrString, name?: string): ElementProps => {
    from.id = fromRowId(toRowId(idString));
    from.classFullName = classFullName;
    from.model = IModel.dictionaryId;
    from.code = { spec: "0x1", scope: "0x1", value: name };
    return from;
  };
  const validateName = (name: string, msg: string) => {
    if (name.trim().length === 0 || (/[@^#<>:"/\\"`'|?*\u0000-\u001F]/g.test(name)))
      throw new Error(`illegal ${msg} name "${name}"`);
  };

  export const defaultViewGroupId = 1 as const;

  export interface ViewDbCtorArgs {
    guidMap?: IModelDb.GuidMapper;
    iModel?: IModelDb;
  }

  export class ViewDb extends VersionedSqliteDb implements ViewStoreRpc.Writer, ReadMethods {
    public override myVersion = "4.0.0";
    private _iModel?: IModelDb;
    private _guidMap?: IModelDb.GuidMapper;
    public get guidMap(): IModelDb.GuidMapper { return this._guidMap!; }
    public set guidMap(guidMap: IModelDb.GuidMapper) { this._guidMap = guidMap; }
    public get iModel(): IModelDb { return this._iModel!; }
    public set iModel(iModel: IModelDb) { this._iModel = iModel; }

    public constructor(arg?: ViewDbCtorArgs) {
      super();
      this._iModel = arg?.iModel;
      this._guidMap = arg?.guidMap ?? this._iModel?.elements; // this is only so tests can mock guids
    }

    /** create all the tables for a new ViewDb */
    protected override createDDL() {
      const baseCols = "Id INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT,owner TEXT";
      this.createTable({
        tableName: tableName.views,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,className TEXT NOT NULL,private BOOLEAN NOT NULL,` +
          `groupId INTEGER NOT NULL REFERENCES ${tableName.viewGroups}(Id) ON DELETE CASCADE, ` +
          `modelSel INTEGER REFERENCES ${tableName.modelSelectors}(Id), ` +
          `categorySel INTEGER  NOT NULL REFERENCES ${tableName.categorySelectors}(Id), ` +
          `displayStyle INTEGER NOT NULL REFERENCES ${tableName.displayStyles}(Id)`,
        constraints: "UNIQUE(groupId,name)",
        addTimestamp: true,
      });
      this.createTable({
        tableName: tableName.viewGroups,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,parent INTEGER NOT NULL REFERENCES ${tableName.viewGroups}(Id) ON DELETE CASCADE` +
          `,defaultViewId INTEGER REFERENCES ${tableName.views}(Id)`,
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
      return this.withPreparedSqliteStatement(`SELECT rowId FROM ${tableName.guids} WHERE guid=?`, (stmt) => {
        stmt.bindGuid(1, guid);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    /** @internal */
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
        stmt.bindInteger(8, args.categorySel);
        stmt.bindInteger(9, args.displayStyle);
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
    /** add a row to the "modelSelectors" table, return the RowId
     * @internal
     */
    public addModelSelectorRow(args: SelectorRow): RowId {
      return this.addTableRow(tableName.modelSelectors, args);
    }
    /** add a row to the "categorySelectors" table, return the RowId
     * @internal
     */
    public addCategorySelectorRow(args: SelectorRow): RowId { // for tests
      return this.addTableRow(tableName.categorySelectors, args);
    }
    /** add a row to the "displayStyles" table, return the RowId
     * @internal
     */
    public addDisplayStyleRow(args: DisplayStyleRow): RowId {
      return this.addTableRow(tableName.displayStyles, args);
    }
    /** add a row to the "timelines" table, return the RowId
     * @internal
     */
    public addTimelineRow(args: TimelineRow): RowId {
      return this.addTableRow(tableName.timelines, args);
    }
    /** add a row to the "tags" table, return the RowId
     * @internal
     */
    public addTag(args: TagRow): RowId {
      return this.addTableRow(tableName.tags, args);
    }
    /** add a row to the "searches" table, return the RowId
     * @internal
     */
    public async addSearch(args: SearchRow): Promise<RowId> {
      return this.addTableRow(tableName.searches, args);
    }

    /** add or update a row in the "thumbnails" table, return the RowId
     * @internal
     */
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

    private deleteFromTable(table: string, id: RowIdOrString): void {
      this.withSqliteStatement(`DELETE FROM ${table} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, toRowId(id));
        stmt.stepForWrite();
      });
    }
    /** @internal */
    public deleteViewRow(id: RowIdOrString) {
      return this.deleteFromTable(tableName.views, id);
    }
    public async deleteViewGroup(args: { name: ViewStoreRpc.ViewGroupSpec }) {
      const rowId = this.findViewGroup(args.name);
      if (rowId === 1)
        throw new Error("Cannot delete root group");
      return this.deleteFromTable(tableName.viewGroups, rowId);
    }
    public deleteModelSelectorSync(id: RowIdOrString) {
      return this.deleteFromTable(tableName.modelSelectors, id);
    }
    public async deleteModelSelector(args: { id: RowIdOrString }): Promise<void> {
      return this.deleteModelSelectorSync(args.id);
    }
    public deleteCategorySelectorSync(id: RowIdOrString) {
      return this.deleteFromTable(tableName.categorySelectors, id);
    }
    public deleteDisplayStyleSync(id: RowIdOrString) {
      return this.deleteFromTable(tableName.displayStyles, id);
    }
    public deleteTimelineSync(id: RowIdOrString) {
      return this.deleteFromTable(tableName.timelines, id);
    }
    public deleteTagSync(arg: { name: ViewStoreRpc.TagName }) {
      const id = this.findTagByName(arg.name);
      return this.deleteFromTable(tableName.tags, id);
    }
    public async deleteTag(arg: { name: ViewStoreRpc.TagName }) {
      return this.deleteTagSync(arg);
    }
    public async deleteCategorySelector(args: { id: RowIdOrString }): Promise<void> {
      return this.deleteCategorySelectorSync(args.id);
    }
    public async deleteDisplayStyle(args: { id: RowIdOrString }): Promise<void> {
      return this.deleteDisplayStyleSync(args.id);
    }
    public async deleteTimeline(args: { id: RowIdOrString }): Promise<void> {
      return this.deleteTimelineSync(args.id);
    }
    public deleteSearch(id: RowId) {
      return this.deleteFromTable(tableName.searches, id);
    }
    public deleteThumbnailSync(id: RowString) {
      return this.deleteFromTable(tableName.thumbnails, toRowId(id));
    }
    public async deleteThumbnail(arg: { viewId: RowString }) {
      return this.deleteThumbnailSync(arg.viewId);
    }
    /** get the data for a view from the database
     * @internal
     */
    public getViewRow(viewId: RowId): undefined | ViewRow {
      return this.withSqliteStatement(`SELECT className,name,json,owner,private,groupId,modelSel,categorySel,displayStyle FROM ${tableName.views} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
          isPrivate: stmt.getValueBoolean(4),
          groupId: stmt.getValueInteger(5),
          modelSel: stmt.getValueIntegerMaybe(6),
          categorySel: stmt.getValueInteger(7),
          displayStyle: stmt.getValueInteger(8),
        };
      });
    }
    /** @internal */
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
    /** @internal */
    public getViewGroup(id: RowId): ViewGroupRow | undefined {
      return this.withSqliteStatement(`SELECT name,owner,json,parent,defaultViewId FROM ${tableName.viewGroups} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          name: stmt.getValueString(0),
          owner: stmt.getValueStringMaybe(1),
          json: stmt.getValueString(2),
          parentId: stmt.getValueInteger(3),
          defaultViewId: stmt.getValueIntegerMaybe(4),
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

    /** read a ModelSelector given a rowId
     * @internal
     */
    public getModelSelectorRow(id: RowId): SelectorRow | undefined {
      return this.getTableRow(tableName.modelSelectors, id);
    }
    /** read a CategorySelector given a rowId
     * @internal
     */
    public getCategorySelectorRow(id: RowId): SelectorRow | undefined {
      return this.getTableRow(tableName.categorySelectors, id);
    }
    /** read a DisplayStyle given a rowId
     * @internal
     */
    public getDisplayStyleRow(id: RowId): DisplayStyleRow | undefined {
      return this.getTableRow(tableName.displayStyles, id);
    }
    /** @internal */
    public getTimelineRow(id: RowId): TimelineRow | undefined {
      return this.getTableRow(tableName.timelines, id);
    }
    /** @internal */
    public getTag(id: RowId): TagRow | undefined {
      return this.getTableRow(tableName.tags, id);
    }
    /** @internal */
    public getSearch(id: RowId): SearchRow | undefined {
      return this.getTableRow(tableName.searches, id);
    }

    private updateJson(table: string, id: RowIdOrString, json: string) {
      this.withSqliteStatement(`UPDATE ${table} SET json=? WHERE Id=?`, (stmt) => {
        stmt.bindString(1, json);
        stmt.bindInteger(2, toRowId(id));
        stmt.stepForWrite();
      });
    }
    public async updateViewShared(arg: { viewId: RowIdOrString, isShared: boolean, owner?: string }): Promise<void> {
      if (!arg.isShared && arg.owner === undefined)
        throw new Error("owner must be defined for private views");

      this.withSqliteStatement(`UPDATE ${tableName.views} SET private=?,owner=? WHERE Id=?`, (stmt) => {
        stmt.bindBoolean(1, !arg.isShared);
        stmt.maybeBindString(2, arg.owner);
        stmt.bindInteger(3, toRowId(arg.viewId));
        stmt.stepForWrite();
      });
    }
    /** @internal */
    public updateViewGroupJson(groupId: RowIdOrString, json: string) {
      return this.updateJson(tableName.viewGroups, groupId, json);
    }
    /** @internal */
    public updateModelSelectorJson(modelSelectorId: RowIdOrString, json: string) {
      return this.updateJson(tableName.modelSelectors, modelSelectorId, json);
    }
    /** @internal */
    public updateCategorySelectorJson(categorySelectorId: RowIdOrString, json: string) {
      return this.updateJson(tableName.categorySelectors, categorySelectorId, json);
    }
    /** @internal */
    public updateDisplayStyleJson(styleId: RowId, json: string) {
      return this.updateJson(tableName.displayStyles, styleId, json);
    }
    /** @internal */
    public updateTimelineJson(timelineId: RowId, json: string) {
      return this.updateJson(tableName.timelines, timelineId, json);
    }
    /** @internal */
    public updateSearchJson(searchId: RowId, json: string) {
      return this.updateJson(tableName.searches, searchId, json);
    }
    private updateName(table: string, id: RowIdOrString, name?: string) {
      this.withSqliteStatement(`UPDATE ${table} SET name=? WHERE Id=?`, (stmt) => {
        stmt.maybeBindString(1, name);
        stmt.bindInteger(2, toRowId(id));
        stmt.stepForWrite();
      });
    }
    public async renameView(args: { viewId: RowIdOrString, name: string }): Promise<void> {
      return this.updateName(tableName.views, args.viewId, args.name);
    }
    public async renameViewGroup(args: { groupId: RowIdOrString, name: string }): Promise<void> {
      return this.updateName(tableName.viewGroups, args.groupId, args.name);
    }
    public async renameModelSelector(args: { id: RowIdOrString, name?: string }): Promise<void> {
      return this.updateName(tableName.modelSelectors, args.id, args.name);
    }
    public async renameCategorySelector(args: { id: RowIdOrString, name?: string }): Promise<void> {
      return this.updateName(tableName.categorySelectors, args.id, args.name);
    }
    public async renameDisplayStyle(args: { id: RowIdOrString, name?: string }): Promise<void> {
      return this.updateName(tableName.displayStyles, args.id, args.name);
    }
    public async renameTimeline(args: { id: RowIdOrString, name?: string }): Promise<void> {
      return this.updateName(tableName.timelines, args.id, args.name);
    }
    public async renameSearch(args: { id: RowIdOrString, name: string }): Promise<void> {
      return this.updateName(tableName.searches, args.id, args.name);
    }
    public async renameTag(args: { oldName: string, newName: string }): Promise<void> {
      this.withSqliteStatement(`UPDATE ${tableName.tags} SET name=? WHERE name=?`, (stmt) => {
        stmt.bindString(1, args.newName);
        stmt.bindString(2, args.oldName);
        stmt.stepForWrite();
      });
    }
    /** @internal */
    public addTagToView(args: { viewId: RowId, tagId: RowId }) {
      this.withSqliteStatement(`INSERT OR IGNORE INTO ${tableName.taggedViews} (viewId,tagId) VALUES(?,?)`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        stmt.stepForWrite();
      });
    }
    private deleteViewTag(args: { viewId: RowId, tagId: RowId }): void {
      this.withSqliteStatement(`DELETE FROM ${tableName.taggedViews} WHERE viewId=? AND tagId=?`, (stmt) => {
        stmt.bindInteger(1, args.viewId);
        stmt.bindInteger(2, args.tagId);
        stmt.stepForWrite();
      });
    }
    /** @internal */
    public findViewsForTag(tagId: RowId): RowId[] {
      return this.withSqliteStatement(`SELECT viewId FROM ${tableName.taggedViews} WHERE tagId=?`, (stmt) => {
        stmt.bindInteger(1, tagId);
        const list: RowId[] = [];
        while (stmt.nextRow())
          list.push(stmt.getValueInteger(0));
        return list;
      });
    }
    private findByName(table: string, name: string): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${table} WHERE name=?`, (stmt) => {
        stmt.bindString(1, name);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    /** @internal */
    public getViewGroupByName(name: string, parentId: RowId): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.viewGroups} WHERE name=? AND parent=?`, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, parentId);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    /** @internal */
    public findModelSelectorByName(name: string): RowId {
      return this.findByName(tableName.modelSelectors, name);
    }
    /** @internal */
    public findCategorySelectorByName(name: string): RowId {
      return this.findByName(tableName.categorySelectors, name);
    }
    /** @internal */
    public findDisplayStyleByName(name: string): RowId {
      return this.findByName(tableName.displayStyles, name);
    }
    /** @internal */
    public findTagByName(name: string): RowId {
      return this.findByName(tableName.tags, name);
    }
    /** @internal */
    public findTimelineByName(name: string): RowId {
      return this.findByName(tableName.timelines, name);
    }
    /** @internal */
    public findSearchByName(name: string): RowId {
      return this.findByName(tableName.searches, name);
    }

    private getViewInfoSync(id: RowIdOrString): ViewStoreRpc.ViewInfo | undefined {
      const maybeId = (rowId?: RowId): string | undefined => rowId ? fromRowId(rowId) : undefined;
      return this.withPreparedSqliteStatement(`SELECT owner,className,name,private,groupId,modelSel,categorySel,displayStyle FROM ${tableName.views} WHERE id=?`, (stmt) => {
        const viewId = toRowId(id);
        stmt.bindInteger(1, viewId);
        return stmt.nextRow() ? {
          id: fromRowId(viewId),
          owner: stmt.getValueString(0),
          className: stmt.getValueString(1),
          name: stmt.getValueStringMaybe(2),
          isPrivate: stmt.getValueBoolean(3),
          groupId: fromRowId(stmt.getValueInteger(4)),
          modelSelectorId: maybeId(stmt.getValueInteger(5)),
          categorySelectorId: fromRowId(stmt.getValueInteger(6)),
          displayStyleId: fromRowId(stmt.getValueInteger(7)),
          tags: this.getTagsForView(viewId),
        } : undefined;
      });
    }
    public async getViewInfo(args: { viewId: RowIdOrString }): Promise<ViewStoreRpc.ViewInfo | undefined> {
      return this.getViewInfoSync(args.viewId);
    }

    public async findViewsByOwner(args: { owner: string }): Promise<ViewStoreRpc.ViewInfo[]> {
      const list: ViewStoreRpc.ViewInfo[] = [];
      this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE owner=? ORDER BY Id ASC`, (stmt) => {
        stmt.bindString(1, args.owner);
        while (stmt.nextRow()) {
          const info = this.getViewInfoSync(stmt.getValueInteger(0));
          if (info)
            list.push(info);
        }
      });
      return list;
    }

    /** @internal */
    public findTagIdsForView(viewId: RowId): RowId[] {
      return this.withSqliteStatement(`SELECT tagId FROM ${tableName.taggedViews} WHERE viewId=?`, (stmt) => {
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
      const fedGuid = this.guidMap.getFederationGuidFromId(id);
      return fedGuid ? this.addGuid(fedGuid) : undefined;
    }
    private toCompressedGuidRows(ids: Id64String[] | CompressedId64Set): CompressedId64Set {
      const result = new Set<Id64String>();
      for (const id of (typeof ids === "string" ? CompressedId64Set.iterable(ids) : ids)) {
        const guidRow = this.toGuidRow(id);
        if (undefined !== guidRow)
          result.add(Id64.fromLocalAndBriefcaseIds(guidRow, 0));
      }
      return CompressedId64Set.compressSet(result);
    }
    private fromGuidRow(guidRow: RowId): Id64String | undefined {
      return this.guidMap.getIdFromFederationGuid(this.getGuid(guidRow));
    }
    private fromGuidRowString(id?: string) {
      return (typeof id !== "string" || !isGuidRowString(id)) ? id : this.fromGuidRow(toRowId(id));
    }

    private iterateCompressedGuidRows(guidRows: unknown, callback: (id: Id64String) => void) {
      if (typeof guidRows !== "string")
        return;
      for (const rowId64String of CompressedId64Set.iterable(guidRows)) {
        const elId = this.fromGuidRow(Id64.getLocalId(rowId64String));
        if (undefined !== elId)
          callback(elId);
      }
    }
    private fromCompressedGuidRows(guidRows: CompressedId64Set): CompressedId64Set {
      const result = new Set<Id64String>();
      this.iterateCompressedGuidRows(guidRows, (id) => result.add(id));
      return CompressedId64Set.compressSet(result);
    }
    private toGuidRowMember(base: any, memberName: string) {
      const id = base?.[memberName];
      if (id === undefined)
        return;

      if (typeof id === "string") {
        if (isGuidRowString(id)) {
          // member is already a guid row. Make sure it exists.
          if (undefined === this.getGuid(toRowId(id)))
            throw new Error(`${memberName} id does not exist`);
          return;
        }
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
      if (typeof id === "string" && isGuidRowString(id)) {
        const elId = this.fromGuidRow(toRowId(id));
        if (undefined !== elId) {
          base[memberName] = elId;
          return;
        }
      }
      throw new Error(`invalid ${memberName}: ${id} `);
    }

    private verifyRowId(table: string, rowIdString: RowString): RowId {
      try {
        const rowId = toRowId(rowIdString);
        this.withSqliteStatement(`SELECT 1 FROM ${table} WHERE Id=?`, (stmt) => {
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
        const modelId = this.fromGuidRow(toRowId(model.modelId));
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
      return fromRowId(this.addViewGroupRow({ name: args.name, parentId, json, owner: args.owner }));
    }
    public async getViewGroups(args: { parent?: ViewStoreRpc.ViewGroupSpec }) {
      const parentIdRow = args.parent ? this.findViewGroup(args.parent) : defaultViewGroupId;
      const groups: { id: string, name: string }[] = [];
      this.withSqliteStatement(`SELECT Id,Name FROM ${tableName.viewGroups} WHERE parent=?`, (stmt) => {
        stmt.bindInteger(1, parentIdRow);
        while (stmt.nextRow()) {
          const id = stmt.getValueInteger(0);
          if (id !== defaultViewGroupId) // don't include root group
            groups.push({ id: fromRowId(id), name: stmt.getValueString(1) });
        }
      });
      return groups;
    }

    private makeSelectorJson(props: ViewStoreRpc.SelectorProps, entity: typeof Entity) {
      const selector = { ...props }; // shallow copy
      if (selector.query) {
        selector.query = { ...selector.query }; // shallow copy
        selector.query.from = selector.query.from.toLowerCase().replace(".", ":").replace("bis:", "biscore:");
        if (!this.iModel.getJsClass(selector.query.from).is(entity))
          throw new Error(`query must select from ${entity.classFullName}`);
        if (selector.query.adds)
          selector.query.adds = this.toCompressedGuidRows(selector.query.adds);
        if (selector.query.removes)
          selector.query.removes = this.toCompressedGuidRows(selector.query.removes);
      } else {
        if (!(selector.ids.length))
          throw new Error(`Selector must specify at least one ${entity.className}`);
        selector.ids = this.toCompressedGuidRows(selector.ids);
      }

      return JSON.stringify(selector);
    }

    private querySelectorValues(json: unknown, bindings?: any[] | object): Id64Array {
      if (typeof json !== "object")
        throw new Error("invalid selector");

      const props = json as ViewStoreRpc.SelectorProps;
      if (!props.query) {
        // there's no query, so the ids are the list of elements
        return (typeof props.ids === "string") ? CompressedId64Set.decompressArray(this.fromCompressedGuidRows(props.ids)) : [];
      }

      const query = props.query;
      const sql = `SELECT ECInstanceId FROM ${query.only ? "ONLY " : ""}${query.from}${query.where ? ` WHERE ${query.where}` : ""}`;

      const ids = new Set<string>();
      try {
        this.iModel.withStatement(sql, (stmt) => {
          if (bindings)
            stmt.bindValues(bindings);
          for (const el of stmt) {
            if (typeof el.id === "string")
              ids.add(el.id);
          }
        });
        this.iterateCompressedGuidRows(props.query.adds, (id) => ids.add(id));
        this.iterateCompressedGuidRows(props.query.removes, (id) => ids.delete(id)); // removes take precedence over adds
      } catch (err: any) {
        Logger.logError("ViewStore", `querySelectorValues: ${err.message}`);
      }
      return [...ids];
    }

    public async addCategorySelector(args: { name?: string, selector: ViewStoreRpc.SelectorProps, owner?: string }): Promise<RowString> {
      const json = this.makeSelectorJson(args.selector, Category);
      return fromRowId(this.addCategorySelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public async updateCategorySelector(args: ViewStoreRpc.NameOrId & { selector: ViewStoreRpc.SelectorProps }): Promise<void> {
      const rowId = this.getRowId(tableName.categorySelectors, args);
      const json = this.makeSelectorJson(args.selector, Category);
      return this.updateCategorySelectorJson(rowId, json);
    }

    private getRowId(table: string, arg: ViewStoreRpc.NameOrId): RowId {
      return undefined !== arg.name ? this.findByName(table, arg.name) : toRowId(arg.id);
    }

    /** @internal */
    public getCategorySelectorSync(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): CategorySelectorProps {
      const rowId = this.getRowId(tableName.categorySelectors, args);
      const row = this.getCategorySelectorRow(rowId);
      if (undefined === row)
        throw new Error("CategorySelector not found");

      const props = blankElementProps({}, "BisCore:CategorySelector", rowId, row.name) as CategorySelectorProps;
      props.categories = this.querySelectorValues(JSON.parse(row.json), args.bindings);
      return props;
    }
    public async getCategorySelector(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): Promise<CategorySelectorProps> {
      return this.getCategorySelectorSync(args);
    }

    public async addModelSelector(args: { name?: string, selector: ViewStoreRpc.SelectorProps, owner?: string }): Promise<RowString> {
      const json = this.makeSelectorJson(args.selector, Model);
      return fromRowId(this.addModelSelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public async updateModelSelector(args: ViewStoreRpc.NameOrId & { selector: ViewStoreRpc.SelectorProps }): Promise<void> {
      const rowId = this.getRowId(tableName.modelSelectors, args);
      const json = this.makeSelectorJson(args.selector, Model);
      return this.updateModelSelectorJson(rowId, json);
    }

    public getModelSelectorSync(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): ModelSelectorProps {
      const rowId = this.getRowId(tableName.modelSelectors, args);
      const row = this.getModelSelectorRow(rowId);
      if (undefined === row)
        throw new Error("ModelSelector not found");

      const props = blankElementProps({}, "BisCore:ModelSelector", rowId, row?.name) as ModelSelectorProps;
      props.models = this.querySelectorValues(JSON.parse(row.json), args.bindings);
      return props;
    }
    public async getModelSelector(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): Promise<ModelSelectorProps> {
      return this.getModelSelectorSync(args);
    }
    private makeTimelineJson(timeline: RenderSchedule.ScriptProps): string {
      timeline = cloneProps(timeline);
      if (!Array.isArray(timeline))
        throw new Error("Timeline has no entries");

      return JSON.stringify(this.scriptToGuids(timeline));
    }
    public async addTimeline(args: { name?: string, timeline: RenderSchedule.ScriptProps, owner?: string }): Promise<RowString> {
      const json = this.makeTimelineJson(args.timeline);
      return fromRowId(this.addTimelineRow({ name: args.name, owner: args.owner, json }));
    }
    public async updateTimeline(args: ViewStoreRpc.NameOrId & { timeline: RenderSchedule.ScriptProps }): Promise<void> {
      const rowId = this.getRowId(tableName.timelines, args);
      const json = this.makeTimelineJson(args.timeline);
      return this.updateTimelineJson(rowId, json);
    }

    public getTimelineSync(args: ViewStoreRpc.NameOrId): RenderTimelineProps {
      const rowId = this.getRowId(tableName.timelines, args);
      const row = this.getTimelineRow(rowId);
      if (undefined === row)
        throw new Error("Timeline not found");

      const props = blankElementProps({}, "BisCore:RenderTimeline", rowId, row?.name) as RenderTimelineProps;
      props.script = JSON.stringify(this.scriptFromGuids(JSON.parse(row.json), false));
      return props;
    }
    public async getTimeline(args: ViewStoreRpc.NameOrId): Promise<RenderTimelineProps> {
      return this.getTimelineSync(args);
    }

    /** make a JSON string for a DisplayStyle */
    private makeDisplayStyleJson(args: { className: string, settings: DisplayStyleSettingsProps }): string {
      const settings = cloneProps(args.settings); // don't modify input
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
        if (!ViewStoreRpc.isViewStoreId(settings.renderTimeline))
          this.toGuidRowMember(settings, "renderTimeline");
        delete settings.scheduleScript;
      } else if (settings.scheduleScript) {
        const scriptProps = this.scriptToGuids(settings.scheduleScript);
        if (scriptProps.length > 0)
          settings.scheduleScript = scriptProps;
      }
      return JSON.stringify({ settings, className: args.className });
    }
    public async addDisplayStyle(args: { name?: string, className: string, settings: DisplayStyleSettingsProps, owner?: string }): Promise<RowString> {
      const json = this.makeDisplayStyleJson(args);
      return fromRowId(this.addDisplayStyleRow({ name: args.name, owner: args.owner, json }));
    }
    public async updateDisplayStyle(args: ViewStoreRpc.NameOrId & { className: string, settings: DisplayStyleSettingsProps }): Promise<void> {
      const rowId = this.getRowId(tableName.displayStyles, args);
      const json = this.makeDisplayStyleJson(args);
      return this.updateDisplayStyleJson(rowId, json);
    }
    public getDisplayStyleSync(args: ViewStoreRpc.NameOrId & { opts?: DisplayStyleLoadProps }): DisplayStyleProps {
      const rowId = this.getRowId(tableName.displayStyles, args);
      const row = this.getDisplayStyleRow(rowId);
      if (undefined === row)
        throw new Error("DisplayStyle not found");

      const val = JSON.parse(row.json) as { settings: DisplayStyle3dSettingsProps, className: string };
      const props = blankElementProps({}, val.className, rowId, row.name);
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
    public async getDisplayStyle(args: ViewStoreRpc.NameOrId & { opts?: DisplayStyleLoadProps }): Promise<DisplayStyleProps> {
      return this.getDisplayStyleSync(args);
    }

    private makeViewDefinitionProps(viewDefinition: ViewDefinitionProps) {
      const viewDef = cloneProps(viewDefinition); // don't modify input
      this.verifyRowId(tableName.categorySelectors, viewDef.categorySelectorId);
      this.verifyRowId(tableName.displayStyles, viewDef.displayStyleId);
      if ((viewDef as SpatialViewDefinitionProps).modelSelectorId)
        this.verifyRowId(tableName.modelSelectors, (viewDef as SpatialViewDefinitionProps).modelSelectorId);

      this.toGuidRowMember(viewDef, "baseModelId");
      this.toGuidRowMember(viewDef.jsonProperties?.viewDetails, "acs");
      const props = viewDef as Partial<ViewDefinitionProps>;
      delete props.id;
      delete props.federationGuid;
      delete props.parent;
      delete props.code;
      delete props.model;
      return viewDef;
    }

    private addViewDefinition(args: { readonly viewDefinition: ViewDefinitionProps, group?: ViewStoreRpc.ViewGroupSpec, owner?: string, isPrivate?: boolean }): RowId {
      const name = args.viewDefinition.code.value;
      if (name === undefined)
        throw new Error("ViewDefinition must have a name");
      const groupId = args.group ? this.findViewGroup(args.group) : defaultViewGroupId;
      const maybeRow = (rowString: RowString) => rowString ? toRowId(rowString) : undefined;
      const viewDef = this.makeViewDefinitionProps(args.viewDefinition);

      try {
        return this.addViewRow({
          name,
          className: viewDef.classFullName,
          owner: args.owner,
          groupId,
          isPrivate: args.isPrivate,
          json: JSON.stringify(viewDef),
          modelSel: maybeRow((viewDef as SpatialViewDefinitionProps).modelSelectorId),
          categorySel: toRowId(viewDef.categorySelectorId),
          displayStyle: toRowId(viewDef.displayStyleId),
        });
      } catch (e) {
        const err = e as SqliteStatement.DbError;
        if (err.errorId === "DuplicateValue")
          err.message = `View "${name}" already exists`;
        throw e;
      }
    }

    public async updateViewDefinition(args: { viewId: RowIdOrString, viewDefinition: ViewDefinitionProps }): Promise<void> {
      const maybeRow = (rowString: RowString) => rowString ? toRowId(rowString) : undefined;
      const viewDef = this.makeViewDefinitionProps(args.viewDefinition);

      this.withSqliteStatement(`UPDATE ${tableName.views} SET json=?,modelSel=?,categorySel=?,displayStyle=? WHERE Id=?`, (stmt) => {
        stmt.bindString(1, JSON.stringify(viewDef));
        stmt.maybeBindInteger(2, maybeRow((viewDef as SpatialViewDefinitionProps).modelSelectorId));
        stmt.bindInteger(3, toRowId(viewDef.categorySelectorId));
        stmt.bindInteger(4, toRowId(viewDef.displayStyleId));
        stmt.bindInteger(5, toRowId(args.viewId));
        stmt.stepForWrite();
      });
    }

    public getViewDefinitionSync(args: { viewId: RowIdOrString }): ViewDefinitionProps {
      const viewId = toRowId(args.viewId);
      const row = this.getViewRow(viewId);
      if (undefined === row)
        throw new Error("View not found");

      const props = blankElementProps(JSON.parse(row.json), row.className, viewId, row.name) as ViewDefinitionProps;
      this.fromGuidRowMember(props, "baseModelId");
      this.fromGuidRowMember(props.jsonProperties?.viewDetails, "acs");
      return props;
    }
    public async getViewDefinition(args: { viewId: RowIdOrString }): Promise<ViewDefinitionProps> {
      return this.getViewDefinitionSync(args);
    }

    public async addOrReplaceThumbnail(args: { viewId: RowIdOrString, readonly thumbnail: ThumbnailProps, owner?: string }) {
      const viewRow = this.getViewRow(toRowId(args.viewId));
      if (viewRow === undefined)
        throw new Error("View not found");
      const format: ThumbnailFormatProps = { format: args.thumbnail.format, height: args.thumbnail.height, width: args.thumbnail.width };
      this.addOrReplaceThumbnailRow({ data: args.thumbnail.image, viewId: toRowId(args.viewId), format, owner: args.owner });
    }

    public getThumbnailSync(args: { viewId: RowIdOrString }): ThumbnailProps | undefined {
      const row = this.getThumbnailRow(toRowId(args.viewId));
      return row ? { image: row.data, format: row.format.format, height: row.format.height, width: row.format.width } : undefined;
    }
    public async getThumbnail(args: { viewId: RowIdOrString }): Promise<ThumbnailProps | undefined> {
      return this.getThumbnailSync(args);
    }

    /** find a group with the specified name using path syntax (e.g., "group1/design/issues"). If the group does not exist, return 0.
     * If groupName starts with "@", then it is considered to be a group id and this function verifies that it exists and throws if it does not.
     */
    public findViewGroup(groupName: ViewStoreRpc.ViewGroupSpec): RowId {
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

    /**
     * find a view by name using path syntax (e.g., "group1/design/issues/issue113"). If the view does not exist, return 0.
     * If a groupId is specified, then the view is searched for in that group and the name should not contain a path.
     * @internal
     */
    public findViewIdByName(arg: { name: string, groupId?: RowIdOrString }): RowId {
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
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE name=? AND groupId=?`, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, maybeToRowId(groupId) ?? defaultViewGroupId);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public getViewByNameSync(arg: { name: ViewStoreRpc.ViewName, groupId?: RowIdOrString }): ViewStoreRpc.ViewInfo | undefined {
      const id = this.findViewIdByName(arg);
      return id ? this.getViewInfoSync(id) : undefined;
    }
    public async getViewByName(arg: { name: ViewStoreRpc.ViewName, groupId?: RowIdOrString }): Promise<ViewStoreRpc.ViewInfo | undefined> {
      return this.getViewByNameSync(arg);
    }

    public async getViewGroupInfo(args: { groupId?: ViewStoreRpc.IdString }): Promise<ViewStoreRpc.ViewGroupInfo | undefined> {
      const groupId = args.groupId ? this.findViewGroup(args.groupId) : defaultViewGroupId;
      const groupRow = groupId ? this.getViewGroup(groupId) : undefined;
      if (groupRow === undefined)
        return undefined;
      const info: ViewStoreRpc.ViewGroupInfo = {
        id: fromRowId(groupId),
        name: groupRow.name,
        defaultView: groupRow.defaultViewId ? fromRowId(groupRow.defaultViewId) : undefined,
        parent: fromRowId(groupRow.parentId),
      };
      return info;
    }

    public async changeDefaultViewId(args: { defaultView: RowIdOrString, group?: ViewStoreRpc.ViewGroupSpec }) {
      const groupId = args.group ? this.findViewGroup(args.group) : defaultViewGroupId;
      const viewRow = this.getViewRow(toRowId(args.defaultView));
      if (viewRow === undefined)
        throw new Error("View not found");
      if (viewRow.groupId !== groupId)
        throw new Error("View is not in the specified group");
      const groupRow = this.getViewGroup(groupId);
      if (groupRow === undefined)
        throw new Error("View group not found");
      this.withSqliteStatement(`UPDATE ${tableName.viewGroups} SET defaultViewId=? WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, groupId);
        stmt.bindInteger(2, toRowId(args.defaultView));
        stmt.stepForWrite();
      });
    }
    /** get the array of tags for the specified view. Returns undefined if the view has no tags. */
    public getTagsForView(viewId: RowIdOrString): ViewStoreRpc.TagName[] | undefined {
      const tags: ViewStoreRpc.TagName[] = [];
      this.withPreparedSqliteStatement(`SELECT t.name FROM ${tableName.tags} t JOIN ${tableName.taggedViews} v ON t.Id = v.tagId WHERE v.viewId=?`, (stmt) => {
        stmt.bindInteger(1, toRowId(viewId));
        while (stmt.nextRow())
          tags.push(stmt.getValueString(0));
      });
      return tags.length === 0 ? undefined : tags;
    }

    private iterateViewQuery(queryParams: ViewStoreRpc.QueryParams, callback: (rowId: RowId) => void) {
      const groupId = queryParams.group ? this.findViewGroup(queryParams.group) : defaultViewGroupId;
      let sql = `SELECT Id,className,name,owner,private FROM ${tableName.views} WHERE groupId=? ${queryParams.owner ? " AND (owner=@owner OR private!=1)" : " AND private!=1"}`;
      if (queryParams.classNames)
        sql += ` AND className IN(${queryParams.classNames.map((className) => `'${className}'`).join(",")})`;
      if (queryParams.nameSearch)
        sql += ` AND name ${queryParams.nameCompare ?? "="} @name`;
      if (queryParams.tags)
        sql += ` AND Id IN(SELECT viewId FROM ${tableName.taggedViews} WHERE tagId IN(SELECT Id FROM ${tableName.tags} WHERE name IN(${queryParams.tags.map((tag) => `'${tag}'`).join(",")})))`;
      sql += " ORDER BY name";
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

        while (stmt.nextRow())
          callback(stmt.getValueInteger(0));
      });
    }

    public queryViewsSync(queryParams: ViewStoreRpc.QueryParams): ViewStoreRpc.ViewInfo[] {
      const entries: ViewStoreRpc.ViewInfo[] = [];
      this.iterateViewQuery(queryParams, (rowId) => {
        const view = this.getViewInfoSync(rowId);
        if (view !== undefined)
          entries.push(view);
      });
      return entries;
    }
    public async queryViews(queryParams: ViewStoreRpc.QueryParams): Promise<ViewStoreRpc.ViewInfo[]> {
      return this.queryViewsSync(queryParams);
    }

    public async addTagsToView(args: { viewId: RowIdOrString, tags: string[], owner?: string }) {
      const viewId = toRowId(args.viewId);
      for (const tag of args.tags) {
        let tagId = this.findTagByName(tag);
        if (tagId === 0)
          tagId = this.addTag({ name: tag, owner: args.owner, json: "{}" });
        this.addTagToView({ viewId, tagId });
      }
    }
    public async removeTagFromView(args: { viewId: RowIdOrString, tag: string }) {
      const viewId = toRowId(args.viewId);
      const tagId = this.findTagByName(args.tag);
      if (tagId !== 0)
        this.deleteViewTag({ viewId, tagId });
    }

    public async addView(args: ViewStoreRpc.AddViewArgs): Promise<ViewStoreRpc.IdString> {
      const owner = args.owner;
      if (ViewStoreRpc.isViewStoreId(args.viewDefinition.categorySelectorId)) {
        this.verifyRowId(tableName.categorySelectors, args.viewDefinition.categorySelectorId);
      } else {
        if (args.categorySelectorProps === undefined)
          throw new Error("Must supply categorySelector");
        args.viewDefinition.categorySelectorId = await this.addCategorySelector({ selector: { ids: args.categorySelectorProps.categories }, owner });
      }
      const spatialDef = args.viewDefinition as SpatialViewDefinitionProps;
      if (ViewStoreRpc.isViewStoreId(spatialDef.modelSelectorId)) {
        this.verifyRowId(tableName.modelSelectors, spatialDef.modelSelectorId);
      } else if (args.modelSelectorProps) {
        spatialDef.modelSelectorId = await this.addModelSelector({ selector: { ids: args.modelSelectorProps.models }, owner });
      } else if (args.viewDefinition.classFullName === "BisCore:SpatialViewDefinition") {
        throw new Error("Must supply modelSelector for Spatial views");
      }
      if (ViewStoreRpc.isViewStoreId(spatialDef.displayStyleId)) {
        this.verifyRowId(tableName.displayStyles, spatialDef.displayStyleId);
      } else {
        if (args.displayStyleProps === undefined || args.displayStyleProps.jsonProperties?.styles === undefined)
          throw new Error("Must supply valid displayStyle");
        spatialDef.displayStyleId = await this.addDisplayStyle({ className: args.displayStyleProps.classFullName, settings: args.displayStyleProps.jsonProperties.styles, owner });
      }
      const viewId = this.addViewDefinition(args);
      if (args.tags)
        await this.addTagsToView({ viewId, tags: args.tags, owner });
      if (args.thumbnail)
        await this.addOrReplaceThumbnail({ viewId, thumbnail: args.thumbnail, owner });

      return fromRowId(viewId);
    }

    public async deleteView(arg: { viewId: RowIdOrString }) {
      const rowId = toRowId(arg.viewId);
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

  /** methods of cloud `ViewDb` for read access */
  export interface ReadMethods extends ViewStoreRpc.Reader {
    getViewByNameSync(arg: { name: ViewStoreRpc.ViewName, groupId?: RowId }): ViewStoreRpc.ViewInfo | undefined;
    getCategorySelectorSync(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): CategorySelectorProps;
    getDisplayStyleSync(args: ViewStoreRpc.NameOrId & { opts?: DisplayStyleLoadProps }): DisplayStyleProps;
    getModelSelectorSync(args: ViewStoreRpc.NameOrId & ViewStoreRpc.QueryBindings): ModelSelectorProps;
    getThumbnailSync(args: { viewId: RowString }): ThumbnailProps | undefined;
    getViewDefinitionSync(args: { viewId: RowString }): ViewDefinitionProps;
    queryViewsSync(queryParams: ViewStoreRpc.QueryParams): ViewStoreRpc.ViewInfo[];
  }

  /** arguments to construct a `ViewStore.CloudAccess` */
  export type ViewStoreCtorProps = CloudSqlite.ContainerAccessProps & ViewDbCtorArgs;

  /** Provides access to a cloud-based `ViewDb` */
  export class CloudAccess extends CloudSqlite.DbAccess<ViewDb, ReadMethods, ViewStoreRpc.Writer> {
    public constructor(props: ViewStoreCtorProps) {
      super({ dbType: ViewDb, props, dbName: viewDbName });
    }

    /** Initialize a cloud container for use as a ViewDb. */
    public static async initializeDb(props: CloudSqlite.ContainerAccessProps) {
      return super._initializeDb({ props, dbType: ViewDb, dbName: viewDbName });
    }
  }
}
