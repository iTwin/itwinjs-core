/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { join } from "path";
import { Guid, GuidString, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { ViewStore } from "../../ViewStore";

describe.only("ViewStore", function (this: Suite) {
  this.timeout(0);

  let vs1: ViewStore.ViewDb;

  before(async () => {
    Logger.setLevel("SQLite", LogLevel.None); // we're expecting errors
    const dbName = join(__dirname, "output", "viewStore.db");
    ViewStore.ViewDb.createNewDb(dbName);
    vs1 = new ViewStore.ViewDb();
    vs1.openDb(dbName, OpenMode.ReadWrite);
  });

  after(async () => {
    vs1.closeDb(true);
    Logger.setLevel("SQLite", LogLevel.Error);
  });

  it("ViewDb", async () => {
    expect(vs1.getViewByName({ name: "view1" })).to.be.undefined;
    const v1Id = vs1.addViewRow({ className: "spatial", name: "view1", json: "json1", owner: "owner1", shared: true, groupId: 1 });
    expect(v1Id).equals(1);

    const v1 = vs1.getViewByName({ name: "view1" })!;
    expect(v1.json).equals("json1");
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).equals(1);
    expect(v1.shared).to.be.true;
    expect(v1.name).equals("view1");
    await vs1.updateViewShared(v1Id, false);
    const v1Updated = vs1.getViewByName({ name: "view1" })!;
    expect(v1Updated.shared).to.be.false;

    const v1Id2 = vs1.addViewRow({ className: "spatial", name: "v2", json: "json-v2", owner: "owner1", groupId: 1 });
    expect(v1Id2).equals(2);
    const v2 = vs1.getView(v1Id2)!;
    expect(v2.name).equals("v2");
    await vs1.deleteView(v1Id2);
    expect(vs1.findViewByName("v2", 1)).equals(0);

    const g1 = vs1.addViewGroupRow({ name: "group1" });
    const g2 = vs1.addViewGroupRow({ name: "group2" });
    const g3 = vs1.addViewGroupRow({ name: "group3", parentId: g2, json: "group3-json" });
    const v2Id = vs1.addViewRow({ className: "spatial2", name: "view2", json: "json2", groupId: g1 });
    expect(v2Id).equals(2);

    for (let i = 0; i < 100; i++)
      vs1.addViewRow({ className: "spatial", name: `test view ${i}`, json: `json${i}`, owner: "owner1", groupId: g2 });

    // duplicate name in a group should throw
    expect(() => vs1.addViewRow({ className: "spatial3", name: "test view 0", json: "json-blah", owner: "owner1", groupId: g2 })).to.throw("UNIQUE");
    // allow the same name in different groups
    vs1.addViewRow({ className: "spatial3", name: "test view 0", json: "json-blah", owner: "owner1", groupId: 1 });

    const g3Id = vs1.findViewGroupByName("group3");
    expect(g3Id).equals(g3);
    const group3 = vs1.getViewGroup(g3Id)!;
    expect(group3.name).equals("group3");
    expect(group3.parentId).equals(g2);
    expect(group3.json).equals("group3-json");
    await vs1.updateViewGroupName(g3Id, "group3-updated");
    await vs1.updateViewGroupJson(g3Id, "group3-json-updated");
    const g3Updated = vs1.getViewGroup(g3Id)!;
    expect(g3Updated.name).equals("group3-updated");
    expect(g3Updated.json).equals("group3-json-updated");

    expect(vs1.findViewsByClass(["spatial"]).length).equals(101);
    expect(vs1.findViewsByClass(["spatial2"]).length).equals(1);
    expect(vs1.findViewsByClass(["spatial", "spatial2", "blah"]).length).equals(102);
    expect(vs1.findViewsByClass([]).length).equals(0);
    expect(vs1.findViewsByClass(["blah"]).length).equals(0);
    expect(vs1.findViewsByOwner("owner1").length).equals(102);

    const thumbnail1 = new Uint8Array([2, 33, 23, 0, 202]);
    await vs1.addOrReplaceThumbnail({ data: thumbnail1, viewId: v1Id, json: "thumbnail1-json" });
    await vs1.addOrReplaceThumbnail({ data: thumbnail1, viewId: v2Id, json: "thumbnail2-json" });
    const thumbnail2 = vs1.getThumbnail(v2Id);
    expect(thumbnail2?.data).deep.equals(thumbnail1);
    expect(thumbnail2?.json).equals("thumbnail2-json");
    const thumb3 = new Uint8Array([2, 33, 23, 0, 203]);
    await vs1.addOrReplaceThumbnail({ data: thumb3, viewId: v2Id });
    const thumbnail3 = vs1.getThumbnail(v2Id);
    expect(thumbnail3?.data).deep.equals(thumb3);
    await vs1.addOrReplaceThumbnail({ data: thumbnail1, viewId: 33 });
    expect(vs1.getThumbnail(33)).to.not.be.undefined;
    await vs1.deleteThumbnail(33);
    expect(vs1.getThumbnail(33)).to.be.undefined;

    expect(vs1.getViewByName({ name: "view2", groupId: g1 })?.groupId).equals(g1);
    await vs1.deleteViewGroup(g1);
    expect(vs1.getViewByName({ name: "view2", groupId: g1 })).to.be.undefined;

    vs1.addCategorySelectorRow({ name: "cat1", json: "cat1-json" });
    vs1.addCategorySelectorRow({ name: "cat2", json: "cat2-json" });
    const cat1Id = vs1.findCategorySelectorByName("cat1");
    expect(cat1Id).equals(1);
    let cat1 = vs1.getCategorySelector(cat1Id)!;
    expect(cat1.name).equals("cat1");
    expect(cat1.json).equals("cat1-json");
    await vs1.updateCategorySelectorJson(cat1Id, "cat1-json-updated");
    cat1 = vs1.getCategorySelector(cat1Id)!;
    expect(cat1.json).equals("cat1-json-updated");

    await vs1.deleteCategorySelector(cat1Id);
    expect(vs1.findCategorySelectorByName("cat1")).equals(0);

    vs1.addDisplayStyleRow({ name: "style1", json: "style1-json" });
    vs1.addDisplayStyleRow({ name: "style2", json: "style2-json" });
    const style1Id = vs1.findDisplayStyleByName("style1");
    expect(style1Id).equals(1);
    const style1 = vs1.getDisplayStyle(style1Id)!;
    expect(style1.name).equals("style1");
    expect(style1.json).equals("style1-json");
    await vs1.updateDisplayStyleName(style1Id, "style1-updated");
    const style1UpdatedNameId = vs1.findDisplayStyleByName("style1-updated");
    expect(style1UpdatedNameId).equals(style1Id);

    await vs1.updateDisplayStyleJson(style1Id, "style1-json-updated");
    const style1Updated = vs1.getDisplayStyle(style1Id)!;
    expect(style1Updated.json).equals("style1-json-updated");

    await vs1.deleteDisplayStyle(style1Id);
    expect(vs1.findDisplayStyleByName("style1")).equals(0);
    expect(vs1.findDisplayStyleByName("style2")).equals(2);

    vs1.addModelSelectorRow({ name: "model1", json: "model1-json" });
    const ms2 = vs1.addModelSelectorRow({ json: "model2-json" });
    const model1Id = vs1.findModelSelectorByName("model1");
    expect(model1Id).equals(1);
    const model1 = vs1.getModelSelector(model1Id)!;
    expect(model1.name).equals("model1");
    expect(model1.json).equals("model1-json");
    const model2 = vs1.getModelSelector(ms2)!;
    expect(model2.name).undefined;
    expect(model2.json).equals("model2-json");

    await vs1.updateModelSelectorName(model1Id, "model1-updated");
    const model1UpdatedNameId = vs1.findModelSelectorByName("model1-updated");
    expect(model1UpdatedNameId).equals(model1Id);
    await vs1.updateModelSelectorName(model1Id, undefined);
    expect(vs1.getModelSelector(model1Id)!.name).undefined;

    await vs1.updateModelSelectorJson(model1Id, "model1-json-updated");
    const model1Updated = vs1.getModelSelector(model1Id)!;
    expect(model1Updated.json).equals("model1-json-updated");

    await vs1.deleteModelSelector(model1Id);
    expect(vs1.findModelSelectorByName("model1")).equals(0);

    vs1.addTimelineRow({ name: "timeline1", json: "timeline1-json" });
    vs1.addTimelineRow({ name: "timeline2", json: "timeline2-json" });
    const timeline1Id = vs1.findTimelineByName("timeline1");
    const timeline2Id = vs1.findTimelineByName("timeline2");
    expect(timeline1Id).equals(1);
    const timeline1 = vs1.getTimelineRow(timeline1Id)!;
    expect(timeline1.name).equals("timeline1");
    expect(timeline1.json).equals("timeline1-json");

    await vs1.updateTimelineName(timeline1Id, "timeline1-updated");
    const timeline1UpdatedNameId = vs1.findTimelineByName("timeline1-updated");
    expect(timeline1UpdatedNameId).equals(timeline1Id);

    await vs1.updateTimelineJson(timeline1Id, "timeline1-json-updated");
    const timeline1Updated = vs1.getTimelineRow(timeline1Id)!;
    expect(timeline1Updated.json).equals("timeline1-json-updated");

    await vs1.deleteTimeline(timeline2Id);
    expect(vs1.findTimelineByName("timeline2")).equals(0);

    const t1 = await vs1.addTag({ name: "tag1", json: "tag1-json", owner: "owner1" });
    await vs1.addTag({ name: "tag2", json: "tag2-json" });
    const tag1Id = vs1.findTagByName("tag1");
    expect(tag1Id).equals(t1);
    const tag1 = vs1.getTag(tag1Id)!;
    expect(tag1.name).equals("tag1");
    expect(tag1.json).equals("tag1-json");
    expect(tag1.owner).equals("owner1");
    for (let i = 0; i < 5; i++)
      await vs1.addTag({ name: `test tag${i}`, json: `newTag${i}-json` });

    await vs1.addTagToView({ viewId: v1Id, tagId: tag1Id });
    await vs1.addTagToView({ viewId: v1Id, tagId: 2 });
    await vs1.addTagToView({ viewId: v1Id, tagId: 3 });
    const taggedViewIds = vs1.findViewsForTag(tag1Id);
    expect(taggedViewIds.length).equals(1);
    expect(taggedViewIds[0]).equals(v1Id);
    const tagIds = vs1.findTagsForView(v1Id);
    expect(tagIds.length).equals(3);
    expect(tagIds[0]).equals(tag1Id);
    expect(tagIds[1]).equals(2);
    expect(tagIds[2]).equals(3);

    await vs1.deleteTag(2);
    const tagIdsAfterDelete = vs1.findTagsForView(v1Id);
    expect(tagIdsAfterDelete.length).equals(2);
    expect(tagIdsAfterDelete[0]).equals(tag1Id);
    expect(tagIdsAfterDelete[1]).equals(3);

    await vs1.addSearch({ name: "search1", json: "search1-json" });
    const search2 = await vs1.addSearch({ name: "search2", json: "search2-json" });
    await expect(vs1.addSearch({ name: "search1", json: "search1-json" })).to.be.rejectedWith("UNIQUE");
    const search1Id = vs1.findSearchByName("search1");
    expect(search1Id).equals(1);
    const search1 = vs1.getSearch(search1Id)!;
    expect(search1.name).equals("search1");
    expect(search1.json).equals("search1-json");
    await vs1.updateSearchName(search1Id, "search1-updated");
    const search1UpdatedNameId = vs1.findSearchByName("search1-updated");
    expect(search1UpdatedNameId).equals(search1Id);
    await vs1.updateSearchJson(search1Id, "search1-json-updated");
    const search1Updated = vs1.getSearch(search1Id)!;
    expect(search1Updated.json).equals("search1-json-updated");
    await vs1.deleteSearch(search2);
    expect(vs1.findSearchByName("search2")).equals(0);

    const guids: GuidString[] = [];
    const rowIds: ViewStore.RowId[] = [];
    const nGuids = 1000;
    for (let i = 0; i < nGuids; i++) {
      const guid = Guid.createValue();
      const rowid = vs1.addGuid(guid);
      guids.push(guid);
      rowIds.push(rowid);
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
      const rowString1 = ViewStore.tableRowIdToString(row);
      expect(rowString1.startsWith("@")).true;
      expect(ViewStore.rowIdFromString(rowString1)).equals(row); // round trip
    });
    expect(count).equals(nGuids);

    const largeNumber = 0x7ffffffffffff;
    expect(ViewStore.rowIdFromString(ViewStore.tableRowIdToString(largeNumber))).equals(largeNumber);

    vs1.vacuum();
  });
});
