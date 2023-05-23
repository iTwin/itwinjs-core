/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { Optional } from "@itwin/core-bentley";
import { VersionedSqliteDb } from "./SQLiteDb";
import { CloudSqlite } from "./CloudSqlite";

/** @beta */
export namespace ViewStore {

  export const tableName = {
    views: "views",
    groups: "viewGroups",
    modelSelectors: "modelSelectors",
    categorySelectors: "categorySelectors",
    displayStyles: "displayStyles",
    timelines: "timelines",
    tags: "tags",
    taggedViews: "taggedViews",
  } as const;

  export type ThumbnailData = Uint8Array;

  /** A row in a table. 0 means "not present" */
  export type RowId = number;
  export interface TableRow {
    className: string;
    name: string;
    json: string;
    owner?: string;
  }
  export type DisplayStyleRow = TableRow;
  export type SelectorRow = TableRow;
  export type TagRow = TableRow;

  export interface ViewRow extends TableRow {
    groupId?: RowId;
    shared?: boolean;
    thumbnail?: ThumbnailData;
  }

  export interface GroupRow extends Optional<TableRow, "json"> {
    parentId?: RowId;
  }
  export interface TimelineRow extends TableRow {
    blob?: Uint8Array;
  }
  export interface TaggedViewRow {
    viewId: RowId;
    tagId: RowId;
  }

  export class ViewDb extends VersionedSqliteDb {
    public override myVersion = "4.0.0";

    protected override createDDL() {
      const makeTable = (table: string, extra?: string) => {
        this.createTable({ tableName: table, columns: `Id INTEGER PRIMARY KEY,className TEXT NOT NULL,name TEXT NOT NULL UNIQUE COLLATE NOCASE,json TEXT,owner TEXT ${extra}`, addTimestamp: true });
      };
      makeTable(tableName.views, `,shared BOOLEAN,groupId INTEGER REFERENCES ${tableName.groups}(Id) ON DELETE SET NULL,thumbnail BLOB`);
      makeTable(tableName.groups, `,parent INTEGER REFERENCES ${tableName.groups}(Id) ON DELETE CASCADE`);
      makeTable(tableName.modelSelectors);
      makeTable(tableName.categorySelectors);
      makeTable(tableName.displayStyles);
      makeTable(tableName.timelines, ",blob BLOB");
      makeTable(tableName.tags);
      this.createTable({
        tableName: tableName.taggedViews, columns: `viewId NOT NULL REFERENCES ${tableName.views}(Id) ON DELETE CASCADE,tagId NOT NULL REFERENCES ${tableName.tags}(Id) ON DELETE CASCADE`,
      });
    }

    public async addView(args: ViewRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.views}(className,name,json,owner,shared,groupId,thumbnail) VALUES (?,?,?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        stmt.maybeBindBoolean(5, args.shared);
        stmt.maybeBindInteger(6, args.groupId);
        stmt.maybeBindBlob(7, args.thumbnail);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    public async addViewGroup(args: GroupRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.groups}(className,name,owner,parent,json) VALUES (?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.maybeBindString(3, args.owner);
        stmt.maybeBindInteger(4, args.parentId);
        stmt.maybeBindString(5, args.json);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    private async addSelector(table: string, args: SelectorRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${table}(className,name,json,owner) VALUES (?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }
    public async addModelSelector(args: SelectorRow): Promise<RowId> {
      return this.addSelector(tableName.modelSelectors, args);
    }
    public async addCategorySelector(args: SelectorRow): Promise<RowId> {
      return this.addSelector(tableName.categorySelectors, args);
    }
    public async addDisplayStyle(args: DisplayStyleRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.displayStyles}(className,name,json,owner) VALUES (?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }
    public async addTimeline(args: TimelineRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.timelines}(className,name,json,owner,blob) VALUES (?,?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        stmt.maybeBindBlob(5, args.blob);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }

    public async addTag(args: TagRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.tags}(className,name,json,owner) VALUES (?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
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
    public getView(viewId: RowId): undefined | Omit<ViewRow, "thumbnail"> {
      return this.withSqliteStatement(`SELECT className,name,json,owner,shared,groupId FROM ${tableName.views} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, viewId);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
          shared: stmt.getValueBoolean(4),
          groupId: stmt.getValueIntegerMaybe(5),
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
      return this.withSqliteStatement(`SELECT className,name,owner,json,parent FROM ${tableName.groups} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          owner: stmt.getValueStringMaybe(2),
          json: stmt.getValueStringMaybe(3),
          parentId: stmt.getValueIntegerMaybe(4),
        };
      });
    }
    private getSelector(table: string, id: RowId): SelectorRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner FROM ${table} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
        };
      });
    }

    /** read a ModelSelector given a rowId */
    public getModelSelector(id: RowId): SelectorRow | undefined {
      return this.getSelector(tableName.modelSelectors, id);
    }
    /** read a CategorySelector given a rowId */
    public getCategorySelector(id: RowId): SelectorRow | undefined {
      return this.getSelector(tableName.categorySelectors, id);
    }
    /** read a DisplayStyle given a rowId */
    public getDisplayStyle(id: RowId): DisplayStyleRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner FROM ${tableName.displayStyles} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
        };
      });
    }
    public getTimeline(id: RowId): TimelineRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner,blob FROM ${tableName.timelines} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
          blob: stmt.getValueBlobMaybe(4),
        };
      });
    }
    public getTag(id: RowId): TagRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner FROM ${tableName.tags} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
        };
      });
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
    public async updateTimeline(timelineId: RowId, arg: { json: string, blob?: Uint8Array }): Promise<void> {
      this.withSqliteStatement(`UPDATE ${tableName.timelines} SET json=?,blob=? WHERE Id=?`, (stmt) => {
        stmt.bindString(1, arg.json);
        stmt.maybeBindBlob(2, arg.blob);
        stmt.bindInteger(3, timelineId);
        this.stepForWrite(stmt);
      });
    }
    private async updateName(table: string, id: RowId, name: string): Promise<void> {
      this.withSqliteStatement(`UPDATE ${table} SET name=? WHERE Id=?`, (stmt) => {
        stmt.bindString(1, name);
        stmt.bindInteger(2, id);
        this.stepForWrite(stmt);
      });
    }
    public async updateViewName(viewId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.views, viewId, name);
    }
    public async updateViewGroupName(groupId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.groups, groupId, name);
    }
    public async updateModelSelectorName(selectorId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.modelSelectors, selectorId, name);
    }
    public async updateCategorySelectorName(selectorId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.categorySelectors, selectorId, name);
    }
    public async updateDisplayStyleName(styleId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.displayStyles, styleId, name);
    }
    public async updateTimelineName(timelineId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.timelines, timelineId, name);
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
    private findByName(table: string, name: string): RowId {
      return this.withSqliteStatement(`SELECT Id FROM ${table} WHERE name=?`, (stmt) => {
        stmt.bindString(1, name);
        return !stmt.nextRow() ? 0 : stmt.getValueInteger(0);
      });
    }
    public findViewByName(name: string): RowId {
      return this.findByName(tableName.views, name);
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

    public getViewByName(name: string): Omit<ViewRow, "thumbnail"> | undefined {
      const id = this.findViewByName(name);
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
