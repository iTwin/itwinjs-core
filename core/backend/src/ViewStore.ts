/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ViewDefinitions
 */

import { Optional } from "@itwin/core-bentley";
import { VersionedSqliteDb } from "./SQLiteDb";

export namespace ViewStore {

  export const tableName = {
    views: "views",
    groups: "groups",
    selectors: "selectors",
    styles: "styles",
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
        this.createTable({ tableName: table, columns: `Id INTEGER PRIMARY KEY,className TEXT NOT NULL,name TEXT NOT NULL UNIQUE COLLATE NOCASE,json TEXT,owner${extra}`, addTimestamp: true });
      };
      makeTable(tableName.views, ",shared BOOLEAN,group INTEGER REFERENCES groups(Id) ON DELETE SET NULL,thumbnail BLOB");
      makeTable(tableName.groups, ",parent INTEGER REFERENCES groups(Id) ON DELETE CASCADE");
      makeTable(tableName.selectors);
      makeTable(tableName.styles);
      makeTable(tableName.timelines, ",blob BLOB");
      makeTable(tableName.tags);
      this.createTable({
        tableName: tableName.taggedViews, columns: "viewId NOT NULL REFERENCES views(Id) ON DELETE CASCADE,tagId NOT NULL REFERENCES tags(Id) ON DELETE CASCADE",
      });
    }

    public async addView(args: ViewRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.views}(className,name,json,owner,shared,group,thumbnail) VALUES (?,?,?,?,?,?,?)`, (stmt) => {
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

    public async addGroup(args: GroupRow): Promise<RowId> {
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

    public async addSelector(args: SelectorRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.selectors}(className,name,json,owner) VALUES (?,?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.bindString(3, args.json);
        stmt.maybeBindString(4, args.owner);
        this.stepForWrite(stmt);
        return this.nativeDb.getLastInsertRowId();
      });
    }
    public async addDisplayStyle(args: DisplayStyleRow): Promise<RowId> {
      return this.withSqliteStatement(`INSERT INTO ${tableName.styles}(className,name,json,owner) VALUES (?,?,?,?)`, (stmt) => {
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
      return this.withSqliteStatement(`INSERT INTO ${tableName.tags}(className,name,owner) VALUES (?,?,?)`, (stmt) => {
        stmt.bindString(1, args.className);
        stmt.bindString(2, args.name);
        stmt.maybeBindString(3, args.owner);
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
      this.deleteFromTable(tableName.views, id);
    }
    public async deleteGroup(id: RowId): Promise<void> {
      this.deleteFromTable(tableName.groups, id);
    }
    public async deleteSelector(id: RowId): Promise<void> {
      this.deleteFromTable(tableName.selectors, id);
    }
    public async deleteDisplayStyle(id: RowId): Promise<void> {
      this.deleteFromTable(tableName.styles, id);
    }
    public async deleteTimeline(id: RowId): Promise<void> {
      this.deleteFromTable(tableName.timelines, id);
    }
    public async deleteTag(id: RowId): Promise<void> {
      this.deleteFromTable(tableName.tags, id);
    }
    public getView(viewId: RowId): undefined | Omit<ViewRow, "thumbnail"> {
      return this.withSqliteStatement(`SELECT className,name,json,owner,shared,group FROM ${tableName.views} WHERE Id=?`, (stmt) => {
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
    public getGroup(id: RowId): GroupRow | undefined {
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
    public getSelector(id: RowId): SelectorRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner FROM ${tableName.selectors} WHERE Id=?`, (stmt) => {
        stmt.bindInteger(1, id);
        return !stmt.nextRow() ? undefined : {
          className: stmt.getValueString(0),
          name: stmt.getValueString(1),
          json: stmt.getValueString(2),
          owner: stmt.getValueStringMaybe(3),
        };
      });
    }
    public getDisplayStyle(id: RowId): DisplayStyleRow | undefined {
      return this.withSqliteStatement(`SELECT className,name,json,owner FROM ${tableName.styles} WHERE Id=?`, (stmt) => {
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
    public async updateViewJson(viewId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.views, viewId, json);
    }
    public async updateGroupJson(groupId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.groups, groupId, json);
    }
    public async updateSelectorJson(selectorId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.selectors, selectorId, json);
    }
    public async updateStyleJson(styleId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.styles, styleId, json);
    }
    public async updateTimelineJson(timelineId: RowId, json: string): Promise<void> {
      return this.updateJson(tableName.timelines, timelineId, json);
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
    public async updateGroupName(groupId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.groups, groupId, name);
    }
    public async updateSelectorName(selectorId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.selectors, selectorId, name);
    }
    public async updateStyleName(styleId: RowId, name: string): Promise<void> {
      return this.updateName(tableName.styles, styleId, name);
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
    public async deleteAllViewTags(viewId: RowId): Promise<void> {
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
    public findGroupByName(name: string): RowId {
      return this.findByName(tableName.groups, name);
    }
    public findSelectorByName(name: string): RowId {
      return this.findByName(tableName.selectors, name);
    }
    public findStyleByName(name: string): RowId {
      return this.findByName(tableName.styles, name);
    }
    public findTagByName(name: string): RowId {
      return this.findByName(tableName.tags, name);
    }
    public findTimelineByName(name: string): RowId {
      return this.findByName(tableName.timelines, name);
    }

    public getViewByName(name: string): Omit<ViewRow, "thumbnail"> | undefined {
      const id = this.findViewByName(name);
      return id ? undefined : this.getView(id);
    }

    public findViewsByOwner(owner: string): RowId[] {
      return this.withSqliteStatement(`SELECT Id FROM ${tableName.views} WHERE owner=?`, (stmt) => {
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
      const sql = `SELECT Id FROM ${tableName.views} WHERE className IN (${className.map(() => "?").join(",")})`;
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
}
