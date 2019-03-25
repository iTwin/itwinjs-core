/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BisCodeSpec, ColorDef, DisplayStyleProps, DisplayStyleSettingsProps, IModel, RenderMode, ViewFlags } from "@bentley/imodeljs-common";
import { expect } from "chai";
import * as path from "path";
import { BackendRequestContext, DictionaryModel, DisplayStyle3d, Element, IModelDb } from "../../imodeljs-backend";
import { IModelJsNative } from "../../IModelJsNative";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "../integration/HubUtility";
import { KnownTestLocations } from "../KnownTestLocations";

// spell-checker: disable

describe("ExcludedElements", () => {
  let imodel1: IModelDb;
  let imodel2: IModelDb;
  let imodel4: IModelDb;
  let imodel5: IModelDb;
  const requestContext = new BackendRequestContext();

  before(async () => {
    IModelTestUtils.registerTestBimSchema();
    imodel1 = IModelDb.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = IModelDb.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "CompatibilityTestSeed.bim"), IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    imodel4 = IModelDb.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "GetSetAutoHandledArrayProperties.bim"), IModelTestUtils.resolveAssetFile("GetSetAutoHandledArrayProperties.bim"));
    imodel5 = IModelDb.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim"), IModelTestUtils.resolveAssetFile("mirukuru.ibim"));

    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel1.importSchema(requestContext, schemaPathname); // will throw an exception if import fails
  });

  after(() => {
    imodel1.closeSnapshot();
    imodel2.closeSnapshot();
    imodel4.closeSnapshot();
    imodel5.closeSnapshot();
  });

  it.skip("dump cs file", () => {
    Logger.setLevel(IModelJsNative.LoggerCategory.DgnCore, LogLevel.Trace);
    Logger.setLevel(IModelJsNative.LoggerCategory.Changeset, LogLevel.Trace);
    const db = IModelDb.openStandalone("D:\\dgn\\problem\\83927\\EAP_TT_001\\seed\\EAP_TT_001.bim");
    HubUtility.dumpChangeSetFile(db, "D:\\dgn\\problem\\83927\\EAP_TT_001", "9fd0e30f88e93bec72532f6f1e05688e2c2408cd");
  });

  it("should be able to see all elements in imodel if the excluded elements list is empty", () => {
    // Get a list of elements in imodel1
    let rows: any[] = imodel1.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    let elementIds: Id64String[] = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));

    // Verify that all elements exist in imodel1 when the set of excluded elements is undefined
    let model = imodel1.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    let settings: DisplayStyleSettingsProps = {
      backgroundColor: ColorDef.blue,
      excludedElements: undefined,
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    let props: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    let styleId = imodel1.elements.insertElement(props);
    let style = imodel1.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel1.elements.getElement(elemId)).to.exist;
    });
    imodel1.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel1.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel2
    rows = imodel2.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Verify that all elements exist in imodel2 when the set of excluded elements is undefined
    model = imodel2.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: undefined,
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel2.elements.insertElement(props);
    style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel2.elements.getElement(elemId)).to.exist;
    });
    imodel2.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel2.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel4
    rows = imodel4.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Verify that all elements exist in imodel4 when the set of excluded elements is undefined
    model = imodel4.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: undefined,
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel4.elements.insertElement(props);
    style = imodel4.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel4.elements.getElement(elemId)).to.exist;
    });
    imodel4.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel4.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel5
    rows = imodel5.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Verify that all elements exist in imodel5 when the set of excluded elements is undefined
    model = imodel5.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: undefined,
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel5.elements.insertElement(props);
    style = imodel5.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel5.elements.getElement(elemId)).to.exist;
    });
    imodel5.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel5.elements.getElement(elemId)).to.exist;
    });
  });

  it("all elements in imodel should continue to exist, even if an element is or was in the set of excluded elements", () => {
    // Get a list of elements in the imodel
    let rows: any[] = imodel1.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    let elementIds: Id64String[] = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));

    // Add a style that contains a list of excluded elements & verify that elements persist
    let model = imodel1.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    let settings: DisplayStyleSettingsProps = {
      backgroundColor: ColorDef.blue,
      excludedElements: [elementIds[0], elementIds[2]],
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    let props: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    let styleId = imodel1.elements.insertElement(props);
    let style = imodel1.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel1.elements.getElement(elemId)).to.exist;
    });

    // Delete the style that contins a set of excluded elements
    imodel1.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel1.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel2
    rows = imodel2.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Add a style that contains a list of excluded elements & verify that elements persist
    model = imodel2.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: [elementIds[elementIds.length - 1], elementIds[elementIds.length - 2]],
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel2.elements.insertElement(props);
    style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel2.elements.getElement(elemId)).to.exist;
    });
    // Delete the style that contins a set of excluded elements
    imodel2.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel2.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel4
    rows = imodel4.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Add a style that contains a list of excluded elements & verify that elements persist
    model = imodel4.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: [elementIds[2], elementIds[1]],
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel4.elements.insertElement(props);
    style = imodel4.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel4.elements.getElement(elemId)).to.exist;
    });
    // Delete the style that contins a set of excluded elements
    imodel4.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel4.elements.getElement(elemId)).to.exist;
    });

    // Get a list of elements in imodel5
    rows = imodel5.executeQuery(`SELECT ECInstanceId FROM ${Element.classFullName}`);
    elementIds = [];
    for (const row of rows)
      elementIds.push(Id64.fromJSON(row.id));
    // Add a style that contains a list of excluded elements & verify that elements persist
    model = imodel5.models.getModel(IModel.dictionaryId) as DictionaryModel;
    expect(model).not.to.be.undefined;
    settings = {
      backgroundColor: ColorDef.blue,
      excludedElements: [elementIds[0], elementIds[elementIds.length - 1]],
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };
    props = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };
    styleId = imodel5.elements.insertElement(props);
    style = imodel5.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    elementIds.forEach((elemId) => {
      expect(imodel5.elements.getElement(elemId)).to.exist;
    });
    // Delete the style that contins a set of excluded elements
    imodel5.elements.deleteElement(styleId);
    elementIds.forEach((elemId) => {
      expect(imodel5.elements.getElement(elemId)).to.exist;
    });
  });
});
