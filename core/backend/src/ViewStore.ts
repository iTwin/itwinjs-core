/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { GuidString, Id64, Id64Array, Id64String, MarkRequired, Optional } from "@itwin/core-bentley";
import { VersionedSqliteDb } from "./SQLiteDb";
import { CloudSqlite } from "./CloudSqlite";
import { IModelDb } from "./IModelDb";
import { DisplayStyleProps, SpatialViewDefinitionProps, ViewDefinitionProps } from "@itwin/core-common";

/** @beta */
export namespace ViewStore {

  export const tableName = {
    categorySelectors: "categorySelectors",
    displayStyles: "displayStyles",
    groups: "viewGroups",
    guids: "guids",
    modelSelectors: "modelSelectors",
    taggedViews: "taggedViews",
    tags: "tags",
    timelines: "timelines",
    searches: "searches",
    views: "views",
  } as const;

  export type ThumbnailData = Uint8Array;

  /** A row in a table. 0 means "not present" */
  export type RowId = number;
  /** a string representation of a row in a table of a ViewStore. Will be a base-36 integer with a leading "@" (e.g."@t4e3") */
  export type RowString = string;

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

  export interface ViewRow extends MarkRequired<TableRow, "name"> {
    className: string;
    groupId: RowId;
    shared?: boolean;
    thumbnail?: ThumbnailData;
  }

  export interface GroupRow extends Optional<TableRow, "json"> {
    parentId: RowId;
  }
  export interface TaggedViewRow {
    viewId: RowId;
    tagId: RowId;
  }

  export const rowIdToString = (rowId: RowId): RowString => {
    return `@${rowId.toString(36)}`;
  };
  export const rowIdFromString = (id: RowString): RowId => {
    if (!id.startsWith("@"))
      throw new Error(`invalid row id`);
    return parseInt(id.slice(1), 36);
  };

  export const defaultViewGroupId = 1 as const;

  export class ViewDb extends VersionedSqliteDb {
    public override myVersion = "4.0.0";

    protected override createDDL() {
      const baseCols = "Id INTEGER PRIMARY KEY,json TEXT,owner TEXT";
      this.createTable({
        tableName: tableName.views,
        columns: `${baseCols},name TEXT NOT NULL COLLATE NOCASE,className TEXT NOT NULL,shared BOOLEAN,groupId INTEGER NOT NULL REFERENCES ${tableName.groups}(Id) ON DELETE CASCADE,thumbnail BLOB`,
        constraints: "UNIQUE(groupId,name)",
        addTimestamp: true,
      });

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
      this.createTable({
        tableName: tableName.taggedViews, columns: `viewId NOT NULL REFERENCES ${tableName.views}(Id) ON DELETE CASCADE,tagId NOT NULL REFERENCES ${tableName.tags}(Id) ON DELETE CASCADE`,
      });
      this.createTable({ tableName: tableName.guids, columns: `guid BLOB NOT NULL UNIQUE` });
      this.addViewGroup({ name: "Root" });
    }

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
    public addGuid(guid: GuidString): RowId {
      const existing = this.getGuidRow(guid);
      return existing !== 0 ? existing : this.withPreparedSqliteStatement(`INSERT INTO ${tableName.guids}(guid) VALUES (?)`, (stmt) => {
        stmt.bindGuid(1, guid);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }
    public addViewRow(args: ViewRow): RowId {
      return this.withSqliteStatement(`INSERT INTO ${tableName.views}(className,name,json,owner,shared,groupId,thumbnail) VALUES (?,?,?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        stmt.maybeBindBoolean(5, args.shared);
        stmt.bindInteger(6, args.groupId ?? 1);
        stmt.maybeBindBlob(7, args.thumbnail);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    public addViewGroup(args: Optional<GroupRow, "parentId">): RowId {
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
    public addModelSelectorRow(args: SelectorRow): RowId {
      return this.addTableRow(tableName.modelSelectors, args);
    }
    public addCategorySelectorRow(args: SelectorRow): RowId { // for tests
      return this.addTableRow(tableName.categorySelectors, args);
    }
    public addDisplayStyleRow(args: DisplayStyleRow): RowId {
      return this.addTableRow(tableName.displayStyles, args);
    }
    public addTimelineRow(args: TimelineRow): RowId {
      return this.addTableRow(tableName.timelines, args);
    }
    public async addTag(args: TagRow): Promise<RowId> {
      return this.addTableRow(tableName.tags, args);
    }
    public async addSearch(args: SearchRow): Promise<RowId> {
      return this.addTableRow(tableName.searches, args);
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

    public getView(viewId: RowId): undefined | Omit<ViewRow, "thumbnail"> {
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
    public getThumbnail(viewId: RowId): undefined | ThumbnailData {
      return this.withSqliteStatement(`SELECT thumbnail FROM ${tableName.views} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : stmt.getValueBlobMaybe(0);
      });
    }
    public getViewGroup(id: RowId): GroupRow | undefined {
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
    public getTimeline(id: RowId): TimelineRow | undefined {
      return this.getTableRow(tableName.timelines, id);
    }
    public getTag(id: RowId): TagRow | undefined {
      return this.getTableRow(tableName.tags, id);
    }
    public getSearch(id: RowId): SearchRow | undefined {
      return this.getTableRow(tableName.searches, id);
    }

    public async updateViewThumbnail(viewId: RowId, thumbnail: ThumbnailData): Promise<void> {
      this.withSqliteStatement(`UPDATE ${tableName.views} SET thumbnail=? WHERE Id=?`, (stmt) => {
        stmt.bindBlob(1, thumbnail);
        stmt.bindInteger(2, viewId);
        this.stepForWrite(stmt);
      });
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
    public getViewByName(name: string, groupId: RowId): Omit<ViewRow, "thumbnail"> | undefined {
      const id = this.findViewByName(name, groupId);
      return id ? this.getView(id) : undefined;
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

    private swizzleId(iModel: IModelDb, id: Id64String): RowId {
      const fedGuid = iModel.withPreparedSqliteStatement(`SELECT FederationGuid FROM bis_Element WHERE Id=?`, (stmt) => {
        stmt.bindId(1, id);
        if (!stmt.nextRow())
          throw new Error("Element not found");
        const guid = stmt.getValueGuid(0);
        if (undefined === guid)
          throw new Error("Element has no federationGuid");
        return guid;
      });
      return this.addGuid(fedGuid);
    }
    private swizzleIds(iModel: IModelDb, ids: Id64String[]): RowId[] {
      return ids.map((id) => this.swizzleId(iModel, id));
    }
    private unswizzleId(iModel: IModelDb, id: RowId): Id64String | undefined {
      const guid = this.getGuid(id);
      if (undefined === guid)
        return undefined;
      return iModel.withPreparedSqliteStatement(`SELECT Id FROM bis_Element WHERE FederationGuid=?`, (stmt) => {
        return !stmt.nextRow() ? undefined : stmt.getValueId(0);
      });
    }
    private swizzleMember(iModel: IModelDb, base: any, memberName: string) {
      const id = base?.[memberName];
      if (typeof id === "string" && Id64.isValidId64(id)) {
        try {
          base[memberName] = rowIdToString(this.swizzleId(iModel, id));
        } catch (err) {
          // leave it alone if we can't swizzle it
        }
      }
    }
    private verifyRowId(table: string, rowIdString?: RowString): void {
      if (undefined === rowIdString)
        return; // if missing, it's ok

      const rowId = rowIdFromString(rowIdString);
      this.withSqliteStatement(`SELECT 1 FROM ${table} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, rowId);
        if (!stmt.nextRow())
          throw new Error(`entry missing from ${table}`);
      });
    }

    public async addCategorySelector(args: { iModel: IModelDb, name: string, categories: Id64Array, owner?: string }): Promise<RowString> {
      if (args.categories.length === 0)
        throw new Error("Must specify at least one category");

      const json = JSON.stringify({ categories: this.swizzleIds(args.iModel, args.categories) });
      return rowIdToString(this.addCategorySelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public async addModelSelector(args: { iModel: IModelDb, name: string, models: Id64Array, owner?: string }): Promise<RowString> {
      if (args.models.length === 0)
        throw new Error("Must specify at least one model");

      const json = JSON.stringify({ models: this.swizzleIds(args.iModel, args.models) });
      return rowIdToString(this.addModelSelectorRow({ name: args.name, owner: args.owner, json }));
    }
    public async addViewDefinition(args: { iModel: IModelDb, name: string, viewDef: ViewDefinitionProps, groupId: RowId, owner?: string }): Promise<RowString> {
      const viewDef = args.viewDef;
      this.verifyRowId(tableName.categorySelectors, viewDef.categorySelectorId);
      this.verifyRowId(tableName.displayStyles, viewDef.displayStyleId);
      this.verifyRowId(tableName.modelSelectors, (viewDef as SpatialViewDefinitionProps).modelSelectorId);
      this.swizzleMember(args.iModel, viewDef, "baseModelId");
      this.swizzleMember(args.iModel, viewDef.jsonProperties?.viewDetails, "acs");

      const json = JSON.stringify(viewDef);
      return rowIdToString(this.addViewRow({ name: args.name, className: viewDef.classFullName, owner: args.owner, groupId: args.groupId, json }));
    }

    public async addDisplayStyle(args: { iModel: IModelDb, name: string, displayStyle: DisplayStyleProps, owner?: string }): Promise<RowString> {
      const settings = args.displayStyle.jsonProperties?.styles;
      return "";
    }
  }

  const viewDbName = "ViewDb" as const;

  /** Provides access to a cloud-based `ViewDb` */
  export class CloudAccess extends CloudSqlite.DbAccess<ViewDb> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: ViewDb, props, dbName: viewDbName });
    }

    /** Initialize a cloud container for use as a ViewDb. */
    public static async initializeDb(args: { props: CloudSqlite.ContainerAccessProps }) {
      return super._initializeDb({ ...args, dbType: ViewDb, dbName: viewDbName });
    }
  }

}
