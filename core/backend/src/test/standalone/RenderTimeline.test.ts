/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { Code, DisplayStyleProps, IModel, RenderSchedule, RenderTimelineProps } from "@bentley/imodeljs-common";
import { RenderTimeline } from "../../Element";
import { DisplayStyle } from "../../DisplayStyle";
import { StandaloneDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { IModelTestUtils } from "../IModelTestUtils";

describe("RenderTimeline", () => {
  const scriptJSON: RenderSchedule.ScriptProps = [{
    modelId: "0x123",
    elementTimelines: [{
      batchId: 1,
      elementIds: [ "0xabc", "0xdef" ],
      visibilityTimeline: [{ time: 42, value: 50 }],
    }],
  }];

  const scriptString = JSON.stringify(scriptJSON);

  function insertTimeline(imodel: StandaloneDb): Id64String {
    const props: RenderTimelineProps = {
      model: IModel.dictionaryId,
      classFullName: RenderTimeline.classFullName,
      code: Code.createEmpty(),
      script: scriptString,
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
    expect(() => insertTimeline(imodel)).to.throw("Error inserting element, class=BisCore:RenderTimeline");
    imodel.close();
  });

  it("creates, queries, and updates", () => {
    const imodel = createIModel("CRUD");
    const timelineId = insertTimeline(imodel);
    expect(Id64.isValid(timelineId)).to.be.true;
  });

  it("remaps schedule script Ids on clone", () => {
  });
});
