/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { join } from "path";
import { Guid, GuidString, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { ViewStore } from "../../ViewStore";
import { ThumbnailFormatProps } from "@itwin/core-common";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ViewStore", function (this: Suite) {
  this.timeout(0);

  let vs1: ViewStore.ViewDb;

  before(async () => {
    Logger.setLevel("SQLite", LogLevel.None); // we're expecting errors
    const dbName = join(KnownTestLocations.outputDir, "viewStore.db");
    ViewStore.ViewDb.createNewDb(dbName);
    vs1 = new ViewStore.ViewDb({ guidMap: {} as any });
    vs1.openDb(dbName, OpenMode.ReadWrite);
  });

  after(async () => {
    vs1.closeDb(true);
    Logger.setLevel("SQLite", LogLevel.Error);
  });

  it("ViewDb", async () => {
    const c1 = vs1.addCategorySelectorRow({ name: "first cat", json: "cat1-json" });
    const ds1 = vs1.addDisplayStyleRow({ name: "first style", json: "style1-json" });

    expect(vs1.getViewByNameSync({ name: "view1" })).to.be.undefined;
    const v1Id = vs1.addViewRow({ className: "spatial", name: "view1", json: "json1", owner: "owner10", isPrivate: true, groupId: 1, categorySel: c1, displayStyle: ds1 });
    expect(v1Id).equals(1);

    const v1 = vs1.getViewByNameSync({ name: "view1" })!;
    expect(vs1.findViewIdByName({ name: "view1" })).equals(v1Id);
    expect(vs1.findViewIdByName({ name: "/view1" })).equals(v1Id);
    expect(v1.owner).equals("owner10");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).equals("@1");
    expect(v1.isPrivate).to.be.true;
    expect(v1.name).equals("view1");
    await vs1.updateViewShared({ viewId: v1Id, isShared: true, owner: "owner10" });
    const v1Updated = vs1.getViewByNameSync({ name: "view1" })!;
    expect(v1Updated.isPrivate).to.be.false;

    const v1Id2 = vs1.addViewRow({ className: "spatial", name: "v2", json: "json-v2", owner: "owner1", groupId: 1, categorySel: c1, displayStyle: ds1 });
    expect(v1Id2).equals(2);
    const v2 = vs1.getViewRow(v1Id2)!;
    expect(v2.name).equals("v2");
    vs1.deleteViewRow(v1Id2);
    expect(vs1.findViewIdByName({ name: "v2", groupId: 1 })).equals(0);

    expect(() => vs1.addViewGroupRow({ name: "", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewGroupRow({ name: " ", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewGroupRow({ name: "@bad", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewGroupRow({ name: "bad/name", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewGroupRow({ name: "^fd", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewGroupRow({ name: "sd#fd", json: "" })).to.throw("illegal group");
    expect(() => vs1.addViewRow({ className: "spatial", name: "@bad", json: "json-v2", owner: "owner1", groupId: 1, categorySel: c1, displayStyle: ds1 })).to.throw("illegal view");
    expect(() => vs1.addViewRow({ className: "spatial", name: "bad/name", json: "json-v2", owner: "owner1", groupId: 1, categorySel: c1, displayStyle: ds1 })).to.throw("illegal view");

    const g1 = vs1.addViewGroupRow({ name: "group1", json: "group1-json" });
    const g2 = vs1.addViewGroupRow({ name: "group2", json: "group2-json" });
    const g3 = vs1.addViewGroupRow({ name: "group 3", parentId: g2, json: "group3-json" });
    const g4 = vs1.addViewGroupRow({ name: "group4", parentId: g3, json: "group3-json" });
    const v2Id = vs1.addViewRow({ className: "spatial2", name: "view2", json: "json2", groupId: g4, categorySel: c1, displayStyle: ds1 });
    expect(v2Id).equals(3);

    for (let i = 0; i < 100; i++)
      vs1.addViewRow({ className: "spatial", name: `test view ${i}`, json: `json${i}`, owner: "owner1", groupId: g2, categorySel: c1, displayStyle: ds1 });

    // duplicate name in a group should throw
    expect(() => vs1.addViewRow({ className: "spatial3", name: "test view 0", json: "json-blah", owner: "owner1", groupId: g2, categorySel: c1, displayStyle: ds1 })).to.throw("UNIQUE");
    // allow the same name in different groups
    const v103 = vs1.addViewRow({ className: "spatial3", name: "test view 0", json: "json-blah", owner: "owner1", groupId: 1, categorySel: c1, displayStyle: ds1 });
    const v104 = vs1.addViewRow({ className: "spatial3", name: "another view", json: "json-blah", owner: "owner10", groupId: 1, categorySel: c1, displayStyle: ds1 });

    const g3Id = vs1.getViewGroupByName("group 3", g2);

    expect(g3Id).equals(g3);
    expect(vs1.findViewGroup("group1")).equals(g1);
    expect(vs1.findViewGroup("group 3")).equals(0); // not in the root group
    expect(vs1.findViewGroup("/group2/group 3/")).equals(g3);
    expect(vs1.findViewGroup("/group2/group 3/group4")).equals(g4);
    expect(vs1.findViewGroup("group2/group 3/group4")).equals(g4);
    expect(vs1.findViewGroup(ViewStore.fromRowId(g4))).equals(g4);
    expect(vs1.findViewGroup("group2/group 3/group4/blah")).equals(0);
    expect(vs1.findViewGroup("group2/blah/group4")).equals(0);
    expect(vs1.findViewGroup("blah")).equals(0);
    expect(vs1.findViewGroup("/")).equals(1);
    expect(vs1.findViewGroup("")).equals(1);

    expect(vs1.getViewByNameSync({ name: "view2", groupId: g4 })?.groupId).equals(ViewStore.fromRowId(g4));
    expect(vs1.findViewIdByName({ name: "/group2/group 3/group4/view2" })).equals(v2Id);
    expect(vs1.findViewIdByName({ name: "group2/group 3/group4/view2" })).equals(v2Id);
    expect(vs1.findViewIdByName({ name: `${ViewStore.fromRowId(g4)}/view2` })).equals(v2Id);
    expect(vs1.findViewIdByName({ name: "group2/group 3/group4/not there" })).equals(0);
    expect(vs1.findViewIdByName({ name: "group2/test view 3" })).not.equal(0);

    const group3 = vs1.getViewGroup(g3Id)!;
    expect(group3.name).equals("group 3");
    expect(group3.parentId).equals(g2);
    expect(group3.json).equals("group3-json");
    await vs1.renameViewGroup({ groupId: g3Id, name: "group3-updated" });
    vs1.updateViewGroupJson(g3Id, "group3-json-updated");
    const g3Updated = vs1.getViewGroup(g3Id)!;
    expect(g3Updated.name).equals("group3-updated");
    expect(g3Updated.json).equals("group3-json-updated");

    expect(vs1.queryViewsSync({ group: "group2", classNames: ["spatial"] }).length).equals(100);
    expect(vs1.queryViewsSync({ group: ViewStore.fromRowId(g4), classNames: ["spatial2"] }).length).equals(1);
    expect(vs1.queryViewsSync({ classNames: ["spatial", "spatial3", "blah"] }).length).equals(3);
    expect(vs1.queryViewsSync({ classNames: [] }).length).equals(0);
    expect(vs1.queryViewsSync({ classNames: ["blah"] }).length).equals(0);
    expect((await vs1.findViewsByOwner({ owner: "owner1" })).length).equals(101);

    const thumbnail1 = new Uint8Array([2, 33, 23, 0, 202]);
    const format1: ThumbnailFormatProps = { width: 100, height: 200, format: "jpeg" };
    const format2: ThumbnailFormatProps = { width: 10, height: 20, format: "png" };
    vs1.addOrReplaceThumbnailRow({ data: thumbnail1, viewId: v1Id, format: format1 });
    vs1.addOrReplaceThumbnailRow({ data: thumbnail1, viewId: v2Id, format: format2 });
    const thumbnail2 = vs1.getThumbnailRow(v2Id);
    expect(thumbnail2?.data).deep.equals(thumbnail1);
    expect(thumbnail2?.format).deep.equals(format2);
    const thumb3 = new Uint8Array([2, 33, 23, 0, 203]);
    vs1.addOrReplaceThumbnailRow({ data: thumb3, viewId: v2Id, format: format2 });
    const thumbnail3 = vs1.getThumbnailRow(v2Id);
    expect(thumbnail3?.data).deep.equals(thumb3);
    vs1.addOrReplaceThumbnailRow({ data: thumbnail1, viewId: 33, format: format1 });
    expect(vs1.getThumbnailRow(33)).to.not.be.undefined;
    vs1.deleteThumbnailSync(ViewStore.fromRowId(33));
    expect(vs1.getThumbnailRow(33)).to.be.undefined;

    await vs1.deleteViewGroup({ name: "group1" });
    expect(vs1.getViewByNameSync({ name: "view2", groupId: g1 })).to.be.undefined;

    const cat01 = vs1.addCategorySelectorRow({ name: "cat1", json: "cat1-json" });
    vs1.addCategorySelectorRow({ name: "cat2", json: "cat2-json" });
    const cat1Id = vs1.findCategorySelectorByName("cat1");
    expect(cat1Id).equals(cat01);
    let cat1 = vs1.getCategorySelectorRow(cat1Id)!;
    expect(cat1.name).equals("cat1");
    expect(cat1.json).equals("cat1-json");
    await vs1.updateCategorySelectorJson(cat1Id, "cat1-json-updated");// eslint-disable-line @typescript-eslint/await-thenable
    cat1 = vs1.getCategorySelectorRow(cat1Id)!;
    expect(cat1.json).equals("cat1-json-updated");

    vs1.deleteCategorySelectorSync(cat1Id);
    expect(vs1.findCategorySelectorByName("cat1")).equals(0);

    const ds01 = vs1.addDisplayStyleRow({ name: "style1", json: "style1-json" });
    vs1.addDisplayStyleRow({ name: "style2", json: "style2-json" });
    const style1Id = vs1.findDisplayStyleByName("style1");
    expect(style1Id).equals(ds01);
    const style1 = vs1.getDisplayStyleRow(style1Id)!;
    expect(style1.name).equals("style1");
    expect(style1.json).equals("style1-json");
    await vs1.renameDisplayStyle({ id: style1Id, name: "style1-updated" });
    const style1UpdatedNameId = vs1.findDisplayStyleByName("style1-updated");
    expect(style1UpdatedNameId).equals(style1Id);

    vs1.updateDisplayStyleJson(style1Id, "style1-json-updated");
    const style1Updated = vs1.getDisplayStyleRow(style1Id)!;
    expect(style1Updated.json).equals("style1-json-updated");

    vs1.deleteDisplayStyleSync(style1Id);
    expect(vs1.findDisplayStyleByName("style1")).equals(0);
    expect(vs1.findDisplayStyleByName("style2")).equals(3);

    vs1.addModelSelectorRow({ name: "model1", json: "model1-json" });
    const ms2 = vs1.addModelSelectorRow({ json: "model2-json" });
    const model1Id = vs1.findModelSelectorByName("model1");
    expect(model1Id).equals(1);
    const model1 = vs1.getModelSelectorRow(model1Id)!;
    expect(model1.name).equals("model1");
    expect(model1.json).equals("model1-json");
    const model2 = vs1.getModelSelectorRow(ms2)!;
    expect(model2.name).undefined;
    expect(model2.json).equals("model2-json");

    await vs1.renameModelSelector({ id: model1Id, name: "model1-updated" });
    const model1UpdatedNameId = vs1.findModelSelectorByName("model1-updated");
    expect(model1UpdatedNameId).equals(model1Id);
    await vs1.renameModelSelector({ id: model1Id, name: undefined });
    expect(vs1.getModelSelectorRow(model1Id)!.name).undefined;

    vs1.updateModelSelectorJson(model1Id, "model1-json-updated");
    const model1Updated = vs1.getModelSelectorRow(model1Id)!;
    expect(model1Updated.json).equals("model1-json-updated");

    vs1.deleteModelSelectorSync(model1Id);
    expect(vs1.findModelSelectorByName("model1")).equals(0);

    vs1.addTimelineRow({ name: "timeline1", json: "timeline1-json" });
    vs1.addTimelineRow({ name: "timeline2", json: "timeline2-json" });
    const timeline1Id = vs1.findTimelineByName("timeline1");
    const timeline2Id = vs1.findTimelineByName("timeline2");
    expect(timeline1Id).equals(1);
    const timeline1 = vs1.getTimelineRow(timeline1Id)!;
    expect(timeline1.name).equals("timeline1");
    expect(timeline1.json).equals("timeline1-json");

    await vs1.renameTimeline({ id: timeline1Id, name: "timeline1-updated" });
    const timeline1UpdatedNameId = vs1.findTimelineByName("timeline1-updated");
    expect(timeline1UpdatedNameId).equals(timeline1Id);

    vs1.updateTimelineJson(timeline1Id, "timeline1-json-updated");
    const timeline1Updated = vs1.getTimelineRow(timeline1Id)!;
    expect(timeline1Updated.json).equals("timeline1-json-updated");

    vs1.deleteTimelineSync(timeline2Id);
    expect(vs1.findTimelineByName("timeline2")).equals(0);

    const t1 = vs1.addTag({ name: "tag1", json: "tag1-json", owner: "owner1" });
    vs1.addTag({ name: "tag2", json: "tag2-json" });
    const tag1Id = vs1.findTagByName("tag1");
    expect(tag1Id).equals(t1);
    const tag1 = vs1.getTag(tag1Id)!;
    expect(tag1.name).equals("tag1");
    expect(tag1.json).equals("tag1-json");
    expect(tag1.owner).equals("owner1");
    for (let i = 0; i < 5; i++)
      vs1.addTag({ name: `test tag ${i}`, json: `newTag${i}-json` });

    vs1.addTagToView({ viewId: v1Id, tagId: tag1Id });
    vs1.addTagToView({ viewId: v1Id, tagId: 2 });
    vs1.addTagToView({ viewId: v103, tagId: 2 });
    vs1.addTagToView({ viewId: v104, tagId: 2 });
    vs1.addTagToView({ viewId: v1Id, tagId: 3 });
    const taggedViewIds = vs1.findViewsForTag(tag1Id);
    expect(taggedViewIds.length).equals(1);
    expect(taggedViewIds[0]).equals(v1Id);
    const tags = vs1.getTagsForView(v1Id)!;
    expect(tags.length).equals(3);
    expect(tags[0]).equals("tag1");
    expect(tags[1]).equals("tag2");
    expect(tags[2]).equals("test tag 0");

    vs1.addViewRow({ className: "BisCore:SpatialViewDefinition", name: "my private 2", json: "json1", owner: "owner10", isPrivate: true, groupId: 1, categorySel: c1, displayStyle: ds1 });
    vs1.addViewRow({ className: "BisCore:OrthographicViewDefinition", name: "my private 3", json: "json1", owner: "owner10", isPrivate: true, groupId: 1, categorySel: c1, displayStyle: ds1 });
    vs1.addViewRow({ className: "BisCore:SheetViewDefinition", name: "sheet 3", json: "json1", owner: "owner10", isPrivate: true, groupId: 1, categorySel: c1, displayStyle: ds1 });
    vs1.addViewRow({ className: "BisCore:DrawingViewDefinition", name: "drawing 3", json: "json1", owner: "owner10", isPrivate: true, groupId: 1, categorySel: c1, displayStyle: ds1 });

    let views = vs1.queryViewsSync({ group: "/" });
    expect(views.length).equals(3);
    expect(views[0].name).equals("another view");
    expect(vs1.queryViewsSync({ group: "group1" }).length).equals(0);
    expect(vs1.queryViewsSync({ group: "group2" }).length).equal(100);
    expect(vs1.queryViewsSync({ group: "group2", offset: 20, limit: 10 }).length).equals(10);
    expect(vs1.queryViewsSync({ group: "group2", offset: 20, limit: 100 }).length).equals(80);
    views = vs1.queryViewsSync({ group: "group2", nameSearch: "%20%", nameCompare: "LIKE" });
    expect(views.length).equals(1);
    expect(views[0].name).equals("test view 20");
    views = vs1.queryViewsSync({ group: "group2", nameSearch: "*2*", nameCompare: "GLOB" });
    expect(views.length).equals(19);
    expect(vs1.queryViewsSync({ group: "group2", tags: ["tag1"] }).length).equal(0);
    expect(vs1.queryViewsSync({ tags: ["tag1"] }).length).equal(1);
    views = vs1.queryViewsSync({ tags: ["tag2", "tag1"] });
    expect(views.length).equal(3);
    expect(views[2].tags?.length).equal(3);
    views = vs1.queryViewsSync({ owner: "owner10" });
    expect(views.length).equal(7);
    views = vs1.queryViewsSync({ owner: "owner10", nameSearch: "my%", nameCompare: "LIKE" });
    expect(views.length).equal(2);
    expect(vs1.queryViewsSync({ owner: "owner10", classNames: ["BisCore:SpatialViewDefinition"] }).length).equal(1);
    expect(vs1.queryViewsSync({ owner: "owner10", classNames: ["BisCore:SpatialViewDefinition", "BisCore:OrthographicViewDefinition"] }).length).equal(2);
    expect(vs1.queryViewsSync({ owner: "owner10", classNames: ["BisCore:DrawingViewDefinition"] }).length).equal(1);
    expect(vs1.queryViewsSync({ owner: "owner10", classNames: ["BisCore:DrawingViewDefinition", "BisCore:SheetViewDefinition"] }).length).equal(2);

    await vs1.renameTag({ oldName: "tag2", newName: "tag2-renamed" });
    views = vs1.queryViewsSync({ tags: ["tag2-renamed"] });
    expect(views.length).equal(3);

    vs1.deleteTagSync({ name: "tag2-renamed" });
    const tagIdsAfterDelete = vs1.getTagsForView(v1Id)!;
    expect(tagIdsAfterDelete.length).equals(2);
    expect(tagIdsAfterDelete[0]).equals("tag1");
    expect(tagIdsAfterDelete[1]).equals("test tag 0");

    await vs1.addSearch({ name: "search1", json: "search1-json" });
    const search2 = await vs1.addSearch({ name: "search2", json: "search2-json" });
    await expect(vs1.addSearch({ name: "search1", json: "search1-json" })).to.be.rejectedWith("UNIQUE");
    const search1Id = vs1.findSearchByName("search1");
    expect(search1Id).equals(1);
    const search1 = vs1.getSearch(search1Id)!;
    expect(search1.name).equals("search1");
    expect(search1.json).equals("search1-json");
    await vs1.renameSearch({ id: search1Id, name: "search1-updated" });
    const search1UpdatedNameId = vs1.findSearchByName("search1-updated");
    expect(search1UpdatedNameId).equals(search1Id);
    vs1.updateSearchJson(search1Id, "search1-json-updated");
    const search1Updated = vs1.getSearch(search1Id)!;
    expect(search1Updated.json).equals("search1-json-updated");
    vs1.deleteSearch(search2);
    expect(vs1.findSearchByName("search2")).equals(0);

    const guids: GuidString[] = [];
    const rowIds: ViewStore.RowId[] = [];
    const nGuids = 1000;
    for (let i = 0; i < nGuids; i++) {
      const guid = Guid.createValue();
      const rowId = vs1.addGuid(guid);
      guids.push(guid);
      rowIds.push(rowId);
    }
    for (let i = 0; i < nGuids; i++) {
      expect(vs1.getGuid(rowIds[i])).equals(guids[i]);
      expect(vs1.addGuid(guids[i])).equals(rowIds[i]);
    }

    let count = 0;
    vs1.iterateGuids(rowIds, (guid: GuidString, row: ViewStore.RowId) => {
      count++;
      expect(guid).not.undefined;
      expect(guids.indexOf(guid)).not.equals(-1);
      const rowString1 = ViewStore.fromRowId(row);
      expect(rowString1.startsWith("@")).true;
      expect(ViewStore.toRowId(rowString1)).equals(row); // round trip
    });
    expect(count).equals(nGuids);

    const largeNumber = 0x7ffffffffffff;
    expect(ViewStore.toRowId(ViewStore.fromRowId(largeNumber))).equals(largeNumber);

    vs1.vacuum();
  });
});
