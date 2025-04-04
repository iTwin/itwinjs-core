import { _nativeDb, ECSqlStatement, InstanceProps, Model } from "../../core-backend";
import { Element } from "../../Element";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "node:path";
import * as sinon from "sinon";
import { DbResult } from "@itwin/core-bentley";
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

  it("should properly read an Element, deserialize it, and re-serialize it", async () => {
    // Read an element using getInstance()
    let elementId = "0x34";
    let classId: string | undefined;
    let classFullName: string | undefined;

    // eslint-disable-next-line prefer-const
    [elementId, classId, classFullName] = iModelDb.withPreparedStatement("SELECT ECClassId FROM Bis.Element WHERE ECInstanceId=?", (stmt: ECSqlStatement) => {
      stmt.bindId(1, elementId);
      return stmt.step() === DbResult.BE_SQLITE_ROW ? [elementId, stmt.getValue(0).getId(), stmt.getValue(0).getClassNameForClassId()] : [elementId, undefined, undefined];
    });
    expect(classId).to.not.be.undefined;
    expect(classFullName).to.not.be.undefined;
    classFullName = classFullName!.replaceAll(".", ":");
    const rawInstance: InstanceProps = {
      iModel: iModelDb,
      row: iModelDb[_nativeDb].readInstance({ id: elementId, classFullName }, { useJsNames: true, }),
    };

    // Deserialize the element
    const classDef = iModelDb.getJsClass<typeof Element>(classFullName);
    const elementProps = classDef.deserialize(rawInstance);

    const element = iModelDb.elements.getElementProps(elementId);

    // Verify the element was deserialized correctly
    expect(elementProps).to.not.be.undefined;
    expect(elementProps.classFullName).to.equal(element.classFullName);
    expect(elementProps.id).to.equal(element.id);
    expect(elementProps.code).to.deep.equal(element.code);
    expect(elementProps.model).to.equal(element.model);
    expect(elementProps.parent).to.equal(element.parent);
    if ("extents" in elementProps && "extents" in element) {
      expect(elementProps.extents).to.not.be.undefined;
      expect(elementProps.extents).to.deep.equal(element.extents);
    }
    if ("origin" in elementProps && "origin" in element) {
      expect(elementProps.origin).to.not.be.undefined;
      expect(elementProps.origin).to.deep.equal(element.origin);
    }
    expect(elementProps.jsonProperties).to.deep.equal(element.jsonProperties);

    // Serialize the element again
    const instance = classDef.serialize(elementProps);
    expect(instance).to.not.be.undefined;
    expect(instance.id).to.equal(element.id);
    expect(instance.className).to.equal(element.classFullName);
    expect(instance.codeValue).to.equal(element.code.value);
    expect(instance.codeSpec.id).to.equal(element.code.spec);
    expect(instance.codeScope.id).to.equal(element.code.scope);
    expect(instance.model.id).to.equal(element.model);
    expect(instance.parent).to.equal(element.parent);
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
    const instance = classDef.serialize(elementProps);
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
    const instance = classDef.serialize(modelProps);
    expect(instance).to.not.be.undefined;
    expect(instance.id).to.equal(model.id);
  });
});
