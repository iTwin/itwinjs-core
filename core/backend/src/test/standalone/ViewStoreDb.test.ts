/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { ViewStore } from "../../ViewStore";
import { join } from "path";
import { OpenMode } from "@itwin/core-bentley";

describe.only("ViewStore", function (this: Suite) {
  this.timeout(0);

  let vs1: ViewStore.ViewDb;

  before(async () => {
    const dbName = join(__dirname, "output", "viewStore.db");
    ViewStore.ViewDb.createNewDb(dbName);
    vs1 = new ViewStore.ViewDb();
    vs1.openDb(dbName, OpenMode.ReadWrite);
  });

  after(async () => {
    vs1.closeDb(true);
  });

  it("access ViewStore", async () => {
    expect(vs1.getViewByName("view1")).to.be.undefined;
    const v1Id = await vs1.addView({ className: "spatial", name: "view1", json: "json1", owner: "owner1", shared: true });
    expect(v1Id).equals(1);

    const v1 = vs1.getViewByName("view1")!;
    expect(v1.json).equals("json1");
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).to.be.undefined;
    expect(v1.shared).to.be.true;
    expect(v1.name).equals("view1");
    await vs1.updateViewShared(v1Id, false);
    const v1Updated = vs1.getViewByName("view1")!;
    expect(v1Updated.shared).to.be.false;

    const v1Id2 = await vs1.addView({ className: "spatial", name: "v2", json: "json-v2", owner: "owner1" });
    expect(v1Id2).equals(2);
    const v2 = vs1.getView(v1Id2)!;
    expect(v2.name).equals("v2");
    await vs1.deleteView(v1Id2);
    expect(vs1.findViewByName("v2")).equals(0);

    const g1 = await vs1.addViewGroup({ className: "group1", name: "group1" });
    const g2 = await vs1.addViewGroup({ className: "group1", name: "group2" });
    const g3 = await vs1.addViewGroup({ className: "group1", name: "group3", parentId: g2, json: "group3-json" });
    const v2Id = await vs1.addView({ className: "spatial2", name: "view2", json: "json2", groupId: g1 });
    expect(v2Id).equals(2);

    for (let i = 0; i < 100; i++)
      await vs1.addView({ className: "spatial", name: `test view ${i}`, json: `json${i}`, owner: "owner1" });

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
    expect(vs1.findViewsByOwner("owner1").length).equals(101);

    expect(vs1.getViewByName("view2")?.groupId).equals(g1);
    await vs1.deleteViewGroup(g1);
    expect(vs1.getViewByName("view2")?.groupId).to.be.undefined;
    const thumbnail1 = new Uint8Array([2, 33, 23, 0, 202]);
    await vs1.updateViewThumbnail(v2Id, thumbnail1);
    const thumbnail2 = vs1.getThumbnail(v2Id);
    expect(thumbnail2).deep.equals(thumbnail1);

    await vs1.addCategorySelector({ name: "cat1", className: "cat1class", json: "cat1-json" });
    await vs1.addCategorySelector({ name: "cat2", className: "cat1class", json: "cat2-json" });
    const cat1Id = vs1.findCategorySelectorByName("cat1");
    expect(cat1Id).equals(1);
    let cat1 = vs1.getCategorySelector(cat1Id)!;
    expect(cat1.name).equals("cat1");
    expect(cat1.className).equals("cat1class");
    expect(cat1.json).equals("cat1-json");
    await vs1.updateCategorySelectorJson(cat1Id, "cat1-json-updated");
    cat1 = vs1.getCategorySelector(cat1Id)!;
    expect(cat1.json).equals("cat1-json-updated");

    await vs1.deleteCategorySelector(cat1Id);
    expect(vs1.findCategorySelectorByName("cat1")).equals(0);

    await vs1.addDisplayStyle({ name: "style1", className: "style1class", json: "style1-json" });
    await vs1.addDisplayStyle({ name: "style2", className: "style2class", json: "style2-json" });
    const style1Id = vs1.findDisplayStyleByName("style1");
    expect(style1Id).equals(1);
    const style1 = vs1.getDisplayStyle(style1Id)!;
    expect(style1.name).equals("style1");
    expect(style1.className).equals("style1class");
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

    await vs1.addModelSelector({ name: "model1", className: "model1class", json: "model1-json" });
    await vs1.addModelSelector({ name: "model2", className: "model2class", json: "model2-json" });
    const model1Id = vs1.findModelSelectorByName("model1");
    expect(model1Id).equals(1);
    const model1 = vs1.getModelSelector(model1Id)!;
    expect(model1.name).equals("model1");
    expect(model1.className).equals("model1class");
    expect(model1.json).equals("model1-json");

    await vs1.updateModelSelectorName(model1Id, "model1-updated");
    const model1UpdatedNameId = vs1.findModelSelectorByName("model1-updated");
    expect(model1UpdatedNameId).equals(model1Id);

    await vs1.updateModelSelectorJson(model1Id, "model1-json-updated");
    const model1Updated = vs1.getModelSelector(model1Id)!;
    expect(model1Updated.json).equals("model1-json-updated");

    await vs1.deleteModelSelector(model1Id);
    expect(vs1.findModelSelectorByName("model1")).equals(0);

    const timelineBlob = new Uint8Array([1, 2, 3, 4, 5]);
    await vs1.addTimeline({ name: "timeline1", className: "timeline1class", json: "timeline1-json", blob: timelineBlob });
    await vs1.addTimeline({ name: "timeline2", className: "timeline2class", json: "timeline2-json" });
    const timeline1Id = vs1.findTimelineByName("timeline1");
    const timeline2Id = vs1.findTimelineByName("timeline2");
    expect(timeline1Id).equals(1);
    const timeline1 = vs1.getTimeline(timeline1Id)!;
    expect(timeline1.name).equals("timeline1");
    expect(timeline1.className).equals("timeline1class");
    expect(timeline1.json).equals("timeline1-json");
    expect(timeline1.blob).deep.equals(timelineBlob);

    await vs1.updateTimelineName(timeline1Id, "timeline1-updated");
    const timeline1UpdatedNameId = vs1.findTimelineByName("timeline1-updated");
    expect(timeline1UpdatedNameId).equals(timeline1Id);

    const updatedBlob = new Uint8Array([1, 2, 3, 4, 5, 6]);
    await vs1.updateTimeline(timeline1Id, { json: "timeline1-json-updated", blob: updatedBlob });
    const timeline1Updated = vs1.getTimeline(timeline1Id)!;
    expect(timeline1Updated.json).equals("timeline1-json-updated");
    expect(timeline1Updated.blob).deep.equals(updatedBlob);

    await vs1.deleteTimeline(timeline2Id);
    expect(vs1.findTimelineByName("timeline2")).equals(0);

    const t1 = await vs1.addTag({ className: "tagClass", name: "tag1", json: "tag1-json" });
    await vs1.addTag({ className: "tagClass", name: "tag2", json: "tag2-json" });
    const tag1Id = vs1.findTagByName("tag1");
    expect(tag1Id).equals(t1);
    const tag1 = vs1.getTag(tag1Id)!;
    expect(tag1.name).equals("tag1");
    expect(tag1.className).equals("tagClass");
    expect(tag1.json).equals("tag1-json");
    for (let i = 0; i < 5; i++)
      await vs1.addTag({ className: "tagClass", name: `test tag${i}`, json: `tag${i}-json` });

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
  });
});
