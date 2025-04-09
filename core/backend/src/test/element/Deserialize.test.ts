import { _nativeDb, IModelHost } from "../../core-backend";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "node:path";
import * as sinon from "sinon";
import { expect } from "chai";

describe("Element Deserialize", () => {
  let iModelDb: SnapshotDb;
  let renderIModelDb: SnapshotDb;

  before(async () => {
    // Get Test iModels
    IModelTestUtils.registerTestBimSchema();
    iModelDb = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await iModelDb.importSchemas([schemaPathname]);

    const renderSeedFileName = IModelTestUtils.resolveAssetFile("LargeNumericRenderMaterialTextureId.bim");
    renderIModelDb = SnapshotDb.openFile(renderSeedFileName);
  });

  after(() => {
    iModelDb.saveChanges();
    iModelDb.close();
    renderIModelDb.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  const testElementProps = {
    id: "0x34",
    classFullName: "BisCore:SpatialViewDefinition",
    lastMod: "2017-07-25T20:44:59.889Z",
    isPrivate: false,
    description: "",
    categorySelector: {
      id: "0x37",
      relClassName: "BisCore.ViewDefinitionUsesCategorySelector",
    },
    displayStyle: {
      id: "0x36",
      relClassName: "BisCore.ViewDefinitionUsesDisplayStyle",
    },
    origin: {
      x: -87.73958171815832,
      y: -108.96514044887601,
      z: -0.0853709702222105,
    },
    extents: {
      x: 429.6229727570776,
      y: 232.24786876266097,
      z: 0.1017680889917761,
    },
    yaw: 0,
    pitch: 0,
    roll: 0,
    isCameraOn: false,
    eyePoint: {
      x: 0,
      y: 0,
      z: 0,
    },
    lensAngle: 0,
    focusDistance: 0,
    modelSelector: {
      id: "0x35",
      relClassName: "BisCore.SpatialViewDefinitionUsesModelSelector",
    },
    code: {
      value: "A Views - View 1",
      spec: "0x1c",
      scope: "0x10",
    },
    model: "0x10",
    parent: undefined,
  };

  it("should properly read a Element, deserialize it, and re-serialize it", async () => {
    const element = iModelDb.elements.getElementProps("0x34");
    if (IModelHost.configuration?.enableWIPNativeInstanceFunctions) {
      IModelHost.configuration.enableWIPNativeInstanceFunctions = false;
    }
    const oldElement = iModelDb.elements.getElementProps("0x34");

    // Verify the element was deserialized correctly
    expect(element).to.not.be.undefined;
    expect(element.classFullName).to.equal(oldElement.classFullName);
    expect(element.id).to.equal(oldElement.id);
    expect(element.code).to.deep.equal(oldElement.code);
    expect(element.model).to.equal(oldElement.model);
    expect(element.parent).to.equal(oldElement.parent);
    expect("extents" in element).to.be.true;
    if ("extents" in element && element.extents !== undefined) {
      expect(element.extents).to.not.be.undefined;
      expect(element.extents).to.deep.equal(testElementProps.extents);
    }
    expect("origin" in element).to.be.true;
    if ("origin" in element && element.origin !== undefined) {
      expect(element.origin).to.not.be.undefined;
      expect(element.origin).to.deep.equal(testElementProps.origin);
    }
    expect(element.jsonProperties).to.deep.equal(oldElement.jsonProperties);

    // Serialize the element again
    // const instance = classDef.serialize(elementProps, iModelDb);
    // expect(instance).to.not.be.undefined;
    // expect(instance.id).to.equal(element.id);
    // expect(instance.className).to.equal(element.classFullName);
    // expect(instance.codeValue).to.equal(element.code.value);
    // expect(instance.codeSpec.id).to.equal(element.code.spec);
    // expect(instance.codeScope.id).to.equal(element.code.scope);
    // expect(instance.model.id).to.equal(element.model);
    // expect(instance.parent).to.equal(element.parent);
  });

  it("should properly read a RenderMaterialElement, deserialize it, and re-serialize it", async () => {
    const element = renderIModelDb.elements.getElementProps("0x4c");
    if (IModelHost.configuration?.enableWIPNativeInstanceFunctions) {
      IModelHost.configuration.enableWIPNativeInstanceFunctions = false;
    }
    const oldElement = renderIModelDb.elements.getElementProps("0x4c");

    // Verify the element was deserialized correctly
    expect(element).to.not.be.undefined;
    expect(element.classFullName).to.equal(oldElement.classFullName);
    expect(element.id).to.equal(oldElement.id);
    expect(element.code).to.deep.equal(oldElement.code);
    expect(element.model).to.equal(oldElement.model);
    expect(element.parent).to.equal(oldElement.parent);
    expect(element.federationGuid).to.equal(oldElement.federationGuid);
    expect("paletteName" in element).to.be.true;
    if ("paletteName" in element && element.paletteName !== undefined && "paletteName" in oldElement && oldElement.paletteName !== undefined) {
      expect(element.paletteName).to.not.be.undefined;
      expect(element.paletteName).to.equal(oldElement.paletteName);
    }
    expect(element.jsonProperties).to.deep.equal(oldElement.jsonProperties);

    // Serialize the element again
    // const instance = classDef.serialize(elementProps, renderIModelDb);
    // expect(instance).to.not.be.undefined;
    // expect(instance.id).to.equal(element.id);
    // expect(instance.className).to.equal(element.classFullName);
    // expect(instance.codeValue.id).to.equal(element.code.value);
    // expect(instance.codeSpec.id).to.equal(element.code.spec);
    // expect(instance.codeScope.id).to.equal(element.code.scope);
    // expect(instance.model.id).to.equal(element.model);
    // expect(instance.parent).to.equal(element.parent);
  });

  it("should properly read an Model, deserialize it, and re-serialize it", async () => {
    const model = iModelDb.models.getModelProps("0x1c");
    if (IModelHost.configuration?.enableWIPNativeInstanceFunctions) {
      IModelHost.configuration.enableWIPNativeInstanceFunctions = false;
    }
    const oldModel = iModelDb.models.getModelProps("0x1c");

    // Verify the model was deserialized correctly
    expect(model).to.not.be.undefined;
    expect(model).to.deep.equal(oldModel);

    // Serialize the model again
    // const instance = classDef.serialize(modelProps, iModelDb);
    // expect(instance).to.not.be.undefined;
    // expect(instance.id).to.equal(model.id);
  });
});
