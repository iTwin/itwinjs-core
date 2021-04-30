/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Code, DisplayStyle3dProps, DisplayStyleProps, ElementProps, RenderSchedule, RenderTimelineProps,
} from "@bentley/imodeljs-common";
import {
  CheckpointConnection, DisplayStyle3dState, IModelApp, IModelConnection, SpatialViewState, ViewState,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

function countTileTrees(view: ViewState): number {
  let numTrees = 0;
  view.forEachModelTreeRef((_) => ++numTrees);
  return numTrees;
}
// eslint-disable-file deprecation/deprecation

describe("Schedule script (#integration)", () => {
  let dbOld: IModelConnection; // BisCore 1.0.8. No RenderTimeline element.
  let dbNew: IModelConnection; // BisCore 1.0.13. RenderTimeline element and DisplayStyle pointing to it.
  const viewId = "0x100000004d9";
  const embedStyleId = "0x100000004d8"; // Style with script embedded in jsonProperties.
  const refStyleId = "0x12"; // Style with script stored on RenderTimeline element. Present only in dbNew.
  const timelineId = "0x11"; // RenderTimeline element hosting a schedule script. Present only in dbNew.
  const modelId = "0x10000000001";

  before(async () => {
    await IModelApp.shutdown();
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(TestUtility.testContextName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    const contextId = await TestUtility.queryContextIdByName(TestUtility.testContextName);
    const oldIModelId = await TestUtility.queryIModelIdbyName(contextId, TestUtility.testIModelNames.synchro);
    dbOld = await CheckpointConnection.openRemote(contextId, oldIModelId);
    const newIModelId = await TestUtility.queryIModelIdbyName(contextId, TestUtility.testIModelNames.synchroNew);
    dbNew = await CheckpointConnection.openRemote(contextId, newIModelId);
  });

  after(async () => {
    await dbOld.close();
    await dbNew.close();
    await IModelApp.shutdown();
  });

  it("obtains tile tree with script source Id", async () => {
    // f_1-A:0x100000004d8_#ffffffff_E:0_0x10000000001
    // f_1-A:0x100000004d8_#f_E:0_0x10000000001
    const expectTileTreeProps = async (scriptSourceId: string, nodeId: number, imodel: IModelConnection, expectValid: boolean) => {
      const treeId = `f_1-A:${scriptSourceId}_#${nodeId.toString(16)}_${modelId}`;
      let treeProps;
      let threw = false;
      try {
        treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, treeId);
      } catch (_) {
        threw = true;
      }

      expect(threw).to.equal(!expectValid);
      expect(undefined !== treeProps).to.equal(expectValid);
    };

    await expectTileTreeProps(embedStyleId, 0xffffffff, dbOld, true);
    await expectTileTreeProps(embedStyleId, 123, dbOld, true);
    await expectTileTreeProps(embedStyleId, 0xffffffff, dbNew, true);
    await expectTileTreeProps(embedStyleId, 123, dbNew, true);
    await expectTileTreeProps(timelineId, 0xffffffff, dbNew, true);
    await expectTileTreeProps(timelineId, 123, dbNew, true);
    await expectTileTreeProps(refStyleId, 0xffffffff, dbNew, false);
    await expectTileTreeProps(refStyleId, 123, dbNew, false);
    await expectTileTreeProps("0xbadf00d", 0xffffffff, dbOld, false);
    await expectTileTreeProps("0xbadf00d", 123, dbNew, false);
  });

  it("excludes element Ids if specified", async () => {
    const scriptHasNonEmptyElementIds = (script: RenderSchedule.ScriptProps) => {
      expect(script.length).least(1);
      let numElementIdProps = 0;
      let numNonEmptyElementIdProps = 0;
      for (const modelTimeline of script) {
        expect(modelTimeline.elementTimelines.length).least(1);
        for (const elementTimeline of modelTimeline.elementTimelines) {
          expect(elementTimeline.elementIds).not.to.be.undefined;
          ++numElementIdProps;
          if (0 < elementTimeline.elementIds.length)
            ++numNonEmptyElementIdProps;
        }
      }

      expect(numElementIdProps).least(1);
      return numNonEmptyElementIdProps > 0;
    };

    const styleHasNonEmptyElementIds = (styleProps: DisplayStyleProps) => {
      expect(styleProps.jsonProperties).not.to.be.undefined;
      expect(styleProps.jsonProperties!.styles).not.to.be.undefined;
      const script = styleProps.jsonProperties!.styles!.scheduleScript!; // eslint-disable-line deprecation/deprecation
      expect(script).not.to.be.undefined;
      return scriptHasNonEmptyElementIds(script);
    };

    const timelineHasNonEmptyElementIds = (props: ElementProps | undefined) => {
      expect(props).not.to.be.undefined;
      return scriptHasNonEmptyElementIds(JSON.parse((props as RenderTimelineProps).script));
    };

    const testStyle = async (imodel: IModelConnection) => {
      const styles = await imodel.elements.getProps(embedStyleId);
      expect(styles.length).to.equal(1);
      expect(styleHasNonEmptyElementIds(styles[0] as DisplayStyleProps)).to.be.true;

      const view = await imodel.views.load(viewId);
      expect(view.displayStyle.id).to.equal(embedStyleId);
      expect(styleHasNonEmptyElementIds(view.displayStyle.toJSON())).to.be.false;

      let style = await imodel.elements.loadProps(embedStyleId, { displayStyle: { omitScheduleScriptElementIds: true } });
      expect(style).not.to.be.undefined;
      expect(styleHasNonEmptyElementIds(style!)).to.be.false;

      style = await imodel.elements.loadProps(embedStyleId, { displayStyle: { omitScheduleScriptElementIds: false } });
      expect(style).not.to.be.undefined;
      expect(styleHasNonEmptyElementIds(style!)).to.be.true;

      style = await imodel.elements.loadProps(embedStyleId);
      expect(style).not.to.be.undefined;
      expect(styleHasNonEmptyElementIds(style!)).to.be.true;
    };

    await testStyle(dbOld);
    await testStyle(dbNew);

    const timelines = await dbNew.elements.getProps(timelineId);
    expect(timelines.length).to.equal(1);
    expect(timelineHasNonEmptyElementIds(timelines[0] as RenderTimelineProps)).to.be.true;

    expect(timelineHasNonEmptyElementIds(await dbNew.elements.loadProps(timelineId))).to.be.true;
    expect(timelineHasNonEmptyElementIds(await dbNew.elements.loadProps(timelineId, { renderTimeline: { omitScriptElementIds: false } }))).to.be.true;
    expect(timelineHasNonEmptyElementIds(await dbNew.elements.loadProps(timelineId, { renderTimeline: { omitScriptElementIds: true } }))).to.be.false;
  });

  it("creates an additional tile tree per animation transform node", async () => {
    const view = await dbOld.views.load(viewId);
    expect(view.displayStyle.scheduleScript).not.to.be.undefined;

    expect(countTileTrees(view)).to.equal(2);

    view.displayStyle.settings.scheduleScriptProps = undefined; // eslint-disable-line deprecation/deprecation
    expect(view.displayStyle.scheduleScript).to.be.undefined;
    expect(countTileTrees(view)).to.equal(1);

    const transformTimeline = JSON.parse(`[{"interpolation":2,"time":1526641200,"value":{"orientation":[0,0,0,1],"pivot":[18.318691253662109,-9.0335273742675781,4.1377468109130859],"position":[-17.786201477050781,8.4895801544189453,-3.6213436126708984],"transform":[[1,0,0,0.53248977661132813],[0,1,0,-0.54394721984863281],[0,0,1,0.51640319824218750]]}},{"interpolation":2,"time":1526641260,"value":{"orientation":[0,0,0,1],"pivot":[18.318691253662109,-9.0335273742675781,4.1377468109130859],"position":[-17.78613281250,8.4904203414916992,-3.6213412284851074],"transform":[[1,0,0,0.53255844116210938],[0,1,0,-0.54310703277587891],[0,0,1,0.51640558242797852]]}},{"interpolation":2,"time":1527431880,"value":{"orientation":[0,0,0,1],"pivot":[18.318691253662109,-9.0335273742675781,4.1377468109130859],"position":[-16.876888275146484,19.567762374877930,-3.5913453102111816],"transform":[[1,0,0,1.4418029785156250],[0,1,0,10.534235000610352],[0,0,1,0.54640150070190430]]}},{"interpolation":1,"time":1527850740,"value":{"orientation":[0,0,0,1],"pivot":[18.318691253662109,-9.0335273742675781,4.1377468109130859],"position":[-15.742227554321289,26.631050109863281,-4.1812567710876465],"transform":[[1,0,0,2.5764636993408203],[0,1,0,17.597522735595703],[0,0,1,-0.043509960174560547]]}}]`) as RenderSchedule.TransformEntryProps[];

    const json: RenderSchedule.ModelTimelineProps[] = [{
      modelId,
      elementTimelines: [{
        batchId: 1,
        elementIds: "",
        transformTimeline,
      }, {
        batchId: 2,
        elementIds: "",
        transformTimeline,
      }],
    }];

    view.displayStyle.settings.scheduleScriptProps = json; // eslint-disable-line deprecation/deprecation
    expect(view.displayStyle.scheduleScript).not.to.be.undefined;
    expect(view.displayStyle.scheduleScriptReference!.sourceId).to.equal(embedStyleId);
    expect(countTileTrees(view)).to.equal(3);
  });

  it("updates tile tree references when script changes", async () => {
    const view = await dbOld.views.load(viewId) as SpatialViewState;
    expect(view instanceof SpatialViewState).to.be.true;

    expect(view.displayStyle.scheduleScript).not.to.be.undefined;
    expect(countTileTrees(view)).to.equal(2);

    const script = view.displayStyle.scheduleScript!;
    view.displayStyle.settings.scheduleScriptProps = undefined; // eslint-disable-line deprecation/deprecation
    expect(view.displayStyle.scheduleScript).to.be.undefined;
    expect(countTileTrees(view)).to.equal(1);

    view.displayStyle.settings.scheduleScriptProps = script.toJSON(); // eslint-disable-line deprecation/deprecation
    expect(view.displayStyle.scheduleScript).not.to.be.undefined;
    expect(countTileTrees(view)).to.equal(2);

    const style = view.displayStyle.clone();
    style.settings.scheduleScriptProps = undefined; // eslint-disable-line deprecation/deprecation
    view.displayStyle = style;
    expect(countTileTrees(view)).to.equal(1);
  });

  it("applies to newly-added tile tree references", async () => {
    const view = await dbOld.views.load(viewId) as SpatialViewState;
    view.modelSelector.models.clear();
    expect(countTileTrees(view)).to.equal(0);

    view.modelSelector.models.add(modelId);
    expect(countTileTrees(view)).to.equal(0);

    view.markModelSelectorChanged();
    expect(countTileTrees(view)).to.equal(2);
  });

  async function loadDisplayStyle(styleId: string, imodel: IModelConnection, load = true): Promise<DisplayStyle3dState> {
    const props = (await imodel.elements.getProps(styleId))[0] as DisplayStyle3dProps;
    expect(props).not.to.be.undefined;
    const style = new DisplayStyle3dState(props, imodel);
    if (load)
      await style.load();

    return style;
  }

  it("load script asynchronously", async () => {
    let style = await loadDisplayStyle(embedStyleId, dbNew, false);
    expect(style.scheduleScript).to.be.undefined;

    style = await loadDisplayStyle(refStyleId, dbNew, false);
    expect(style.scheduleScript).to.be.undefined;

    style = await loadDisplayStyle(embedStyleId, dbNew);
    expect(style.scheduleScript).not.to.be.undefined;

    style = await loadDisplayStyle(refStyleId, dbNew);
    expect(style.scheduleScript).not.to.be.undefined;
  });

  it("is cloned when display style is cloned", async () => {
    const embedStyle = await loadDisplayStyle(embedStyleId, dbNew);
    expect(embedStyle.scheduleScript).not.to.be.undefined;
    const embedClone = embedStyle.clone();
    expect(embedClone.scheduleScript).to.equal(embedStyle.scheduleScript);

    const refStyle = await loadDisplayStyle(refStyleId, dbNew);
    expect(refStyle.scheduleScript).not.to.be.undefined;
    const refClone = refStyle.clone();
    expect(refClone.scheduleScript).to.equal(refStyle.scheduleScript);
  });

  it("can be associated with a non-persistent display style by RenderTimeline", async () => {
    const props: DisplayStyle3dProps = {
      classFullName: DisplayStyle3dState.classFullName,
      model: "",
      code: Code.createEmpty(),
      jsonProperties: {
        styles: {
          renderTimeline: timelineId,
        },
      },
    };

    const style = new DisplayStyle3dState(props, dbNew);
    expect(style.scheduleScript).to.be.undefined;
    await style.load();
    expect(style.scheduleScript).not.to.be.undefined;
  });

  it("can be associated with a non-persistent display style by embedding script and supplying persistent display style Id", async () => {
    const persistentStyle = await loadDisplayStyle(embedStyleId, dbOld);
    const scheduleScript = persistentStyle.scheduleScript!.toJSON();

    const props: DisplayStyle3dProps = {
      id: embedStyleId,
      classFullName: DisplayStyle3dState.classFullName,
      model: "",
      code: Code.createEmpty(),
      jsonProperties: {
        styles: {
          scheduleScript,
        },
      },
    };

    const style = new DisplayStyle3dState(props, dbOld);
    expect(style.scheduleScript).to.be.undefined;
    await style.load();
    expect(style.scheduleScript).not.to.be.undefined;
  });
});
