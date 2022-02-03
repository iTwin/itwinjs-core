/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { Id64String} from "@itwin/core-bentley";
import { Id64, OpenMode } from "@itwin/core-bentley";
import type { RenderSchedule, RenderTimelineProps } from "@itwin/core-common";
import { Code, IModel } from "@itwin/core-common";
import { GenericSchema, IModelJsFs, RenderTimeline, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("RenderTimeline", () => {
  before(() => {
    GenericSchema.registerSchema();
  });

  function makeScriptProps(): RenderSchedule.ScriptProps {
    return [{
      modelId: "0x123",
      elementTimelines: [{
        batchId: 1,
        elementIds: ["0xabc", "0xdef"],
        visibilityTimeline: [{ time: 42, value: 50 }],
      }],
    }];
  }

  function insertTimeline(imodel: StandaloneDb, scriptProps?: RenderSchedule.ScriptProps): Id64String {
    const script = JSON.stringify(scriptProps ?? makeScriptProps());
    const props: RenderTimelineProps = {
      model: IModel.dictionaryId,
      classFullName: RenderTimeline.classFullName,
      code: Code.createEmpty(),
      script,
    };
    return imodel.elements.insertElement(props);
  }

  function createIModel(name: string): StandaloneDb {
    const props = {
      rootSubject: {
        name,
      },
      allowEdit: `{ "txns": true }`,
    };
    const filename = IModelTestUtils.prepareOutputFile("RenderTimeline", `${name}.bim`);
    return StandaloneDb.createEmpty(filename, props);
  }

  it("requires BisCore >= 1.0.13", () => {
    const filename = IModelTestUtils.prepareOutputFile("RenderTimeline.SchemaTooOld", "testImodel.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("testImodel.bim");
    IModelJsFs.copySync(seedFileName, filename);

    const imodel = StandaloneDb.openFile(filename, OpenMode.ReadWrite);
    expect(() => insertTimeline(imodel)).to.throw("ecClass not found");
    imodel.close();
  });

  it("creates, queries, and updates", () => {
    const imodel = createIModel("CRUD");
    const timelineId = insertTimeline(imodel);
    expect(Id64.isValid(timelineId)).to.be.true;

    let timeline = imodel.elements.getElement<RenderTimeline>(timelineId);
    expect(timeline).instanceof(RenderTimeline);
    expect(timeline.scriptProps).to.deep.equal(makeScriptProps());
    expect(timeline.description).to.equal("");

    timeline.description = "My timeline";
    const scriptProps = makeScriptProps();
    scriptProps.push(makeScriptProps()[0]);
    timeline.scriptProps = scriptProps;

    timeline.update();
    timeline = imodel.elements.getElement<RenderTimeline>(timelineId);
    expect(timeline.description).to.equal("My timeline");
    expect(timeline.scriptProps).to.deep.equal(scriptProps);

    imodel.close();
  });
});
