import { Element } from "../../Element";
import { _nativeDb, ECSqlStatement, IModelHost, InstanceProps, Model } from "../../core-backend";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "node:path";
import * as sinon from "sinon";
import { DbResult, Id64String } from "@itwin/core-bentley";
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
  });

  afterEach(() => {
    sinon.restore();
  });

  function getInstanceKey(id: Id64String, baseClass: "Element" | "Model") {
    return iModelDb.withPreparedStatement(`SELECT ec_className(ECClassId, 's:c') FROM Bis.${baseClass} WHERE ECInstanceId=?`, (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return { id, classFullName: stmt.getValue(0).getString() };
      }
      throw new Error(`Element with id ${id} not found`);
    });
  }

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

  it("SpatialViewDefinitionUsesModelSelector", async () => {
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
    if ("extents" in element && "extents" in oldElement) {
      expect(element.extents).to.not.be.undefined;
      // expect(element.extents[0]).to.equal(oldElement.extents[0]);
      // expect(element.extents[1]).to.equal(oldElement.extents[1]);
      // expect(element.extents[2]).to.equal(oldElement.extents[2]);
    }
    if ("origin" in element && "origin" in oldElement) {
      expect(element.origin).to.not.be.undefined;
      // expect(element.origin.x).to.equal(oldElement.origin[0]);
      // expect(element.origin.y).to.equal(oldElement.origin[1]);
      // expect(element.origin.z).to.equal(oldElement.origin[2]);
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
    let elementId: string | undefined;
    let classId: string | undefined;
    let classFullName: string | undefined;
    // eslint-disable-next-line prefer-const
    [elementId, classId, classFullName] = renderIModelDb.withPreparedStatement("SELECT ECInstanceId, ECClassId FROM Bis.RenderMaterial", (stmt: ECSqlStatement) => {
      return stmt.step() === DbResult.BE_SQLITE_ROW ? [stmt.getValue(0).getId(), stmt.getValue(1).getId(), stmt.getValue(1).getClassNameForClassId()] : [undefined, undefined, undefined];
    });
    expect(classId).to.not.be.undefined;
    expect(classId).to.not.be.undefined;
    expect(classFullName).to.not.be.undefined;
    classFullName = classFullName!.replaceAll(".", ":");
    const rawInstance: InstanceProps = {
      iModel: renderIModelDb,
      row: renderIModelDb[_nativeDb].readInstance({ id: elementId, classFullName }, { useJsNames: true, }),
    };

    // Deserialize the element
    const classDef = renderIModelDb.getJsClass<typeof Element>(classFullName);
    const elementProps = classDef.deserialize(rawInstance);

    const element = renderIModelDb.elements.getElementProps(elementId!);

    // Verify the element was deserialized correctly
    expect(elementProps).to.not.be.undefined;
    expect(elementProps.classFullName).to.equal(element.classFullName);
    expect(elementProps.id).to.equal(element.id);
    expect(elementProps.code).to.deep.equal(element.code);
    expect(elementProps.model).to.equal(element.model);
    expect(elementProps.parent).to.equal(element.parent);

    // Serialize the element again
    const instance = classDef.serialize(elementProps, renderIModelDb);
    expect(instance).to.not.be.undefined;
    expect(instance.id).to.equal(element.id);
    expect(instance.className).to.equal(element.classFullName);
    expect(instance.codeValue.id).to.equal(element.code.value);
    expect(instance.codeSpec.id).to.equal(element.code.spec);
    expect(instance.codeScope.id).to.equal(element.code.scope);
    expect(instance.model.id).to.equal(element.model);
    expect(instance.parent).to.equal(element.parent);
  });

  it("should properly read an Model, deserialize it, and re-serialize it", async () => {
    // Read a model using getInstance()
    let modelId = "0x1c";
    let classId: string | undefined;
    let classFullName: string | undefined;

    // eslint-disable-next-line prefer-const
    [modelId, classId, classFullName] = iModelDb.withPreparedStatement("SELECT ECClassId FROM Bis.Model WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, modelId);
      return stmt.step() === DbResult.BE_SQLITE_ROW ? [modelId, stmt.getValue(0).getId(), stmt.getValue(0).getClassNameForClassId()] : [modelId, undefined, undefined];
    });
    expect(classId).to.not.be.undefined;
    expect(classFullName).to.not.be.undefined;
    classFullName = classFullName!.replaceAll(".", ":");
    const rawInstance: InstanceProps = {
      iModel: iModelDb,
      row: iModelDb[_nativeDb].readInstance({ id: modelId, classFullName }, { useJsNames: true, }),
    };

    // Deserialize the model
    const classDef = iModelDb.getJsClass<typeof Model>(classFullName);
    const modelProps = classDef.deserialize(rawInstance);

    const model = iModelDb.models.getModelProps(modelId);

    // Verify the model was deserialized correctly
    expect(modelProps).to.not.be.undefined;
    expect(modelProps.classFullName).to.equal(model.classFullName);

    // Serialize the element again
    const instance = classDef.serialize(modelProps, iModelDb);
    expect(instance).to.not.be.undefined;
    expect(instance.id).to.equal(model.id);
  });
});
