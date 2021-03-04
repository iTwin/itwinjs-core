/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { DisplayStyleProps, RenderSchedule } from "@bentley/imodeljs-common";
import { CheckpointConnection, IModelApp, IModelConnection, RenderScheduleState, SpatialViewState, ViewState } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

function countTileTrees(view: ViewState): number {
  let numTrees = 0;
  view.forEachModelTreeRef((_) => ++numTrees);
  return numTrees;
}
// eslint-disable-file deprecation/deprecation

describe("Animated tile trees (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  const viewId = "0x100000004d9";
  const styleId = "0x100000004d8";
  const modelId = "0x10000000001";
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.shutdown();
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });
    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SYNCHRO.UTK");
    imodel = await CheckpointConnection.openRemote(projectId, iModelId);
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  it("obtains tile tree by Id", async () => {
    // f_1-A:0x100000004d8_#ffffffff_E:0_0x10000000001
    // f_1-A:0x100000004d8_#f_E:0_0x10000000001
    const expectTileTreeProps = async (displayStyleId: string, nodeId: number, expectValid: boolean) => {
      const treeId = `f_1-A:${displayStyleId}_#${nodeId.toString(16)}_${modelId}`;
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

    await expectTileTreeProps(styleId, 0xffffffff, true);
    await expectTileTreeProps(styleId, 123, true);
    await expectTileTreeProps("0xbadf00d", 0xffffffff, false);
    await expectTileTreeProps("0xbadf00d", 123, false);
  });

  it("excludes element Ids from schedule scripts", async () => {
    const hasNonEmptyElementIds = (styleProps: DisplayStyleProps) => {
      expect(styleProps.jsonProperties).not.to.be.undefined;
      expect(styleProps.jsonProperties!.styles).not.to.be.undefined;
      const script = styleProps.jsonProperties!.styles!.scheduleScript!;
      expect(script).not.to.be.undefined;
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

    const styles = await imodel.elements.getProps(styleId);
    expect(styles.length).to.equal(1);
    expect(hasNonEmptyElementIds(styles[0] as DisplayStyleProps)).to.be.true;

    const view = await imodel.views.load(viewId);
    expect(view.displayStyle.id).to.equal(styleId);
    expect(hasNonEmptyElementIds(view.displayStyle.toJSON())).to.be.false;
  });

  it("creates an additional tile tree per animation transform node", async () => {
    const view = await imodel.views.load(viewId);
    expect(view.displayStyle.scheduleScript).not.to.be.undefined;

    expect(countTileTrees(view)).to.equal(2);

    view.displayStyle.scheduleScript = undefined;
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

    view.displayStyle.scheduleScript = RenderScheduleState.Script.fromJSON(styleId, json);
    expect(countTileTrees(view)).to.equal(3);
  });

  it("updates tile tree references when schedule script changes", async () => {
    const view = await imodel.views.load(viewId) as SpatialViewState;
    expect(view instanceof SpatialViewState).to.be.true;

    expect(view.displayStyle.scheduleScript).not.to.be.undefined;
    expect(countTileTrees(view)).to.equal(2);

    const script = view.displayStyle.scheduleScript;
    view.displayStyle.scheduleScript = undefined;
    expect(countTileTrees(view)).to.equal(1);

    view.displayStyle.scheduleScript = script;
    expect(countTileTrees(view)).to.equal(2);

    const style = view.displayStyle.clone();
    style.scheduleScript = undefined;
    view.displayStyle = style;
    expect(countTileTrees(view)).to.equal(1);
  });

  it("applies current schedule script to newly-added tile tree references", async () => {
    const view = await imodel.views.load(viewId) as SpatialViewState;
    view.modelSelector.models.clear();
    expect(countTileTrees(view)).to.equal(0);

    view.modelSelector.models.add(modelId);
    expect(countTileTrees(view)).to.equal(0);

    view.markModelSelectorChanged();
    expect(countTileTrees(view)).to.equal(2);
  });
});
