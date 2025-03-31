import { InstanceSerializationMethod } from "@bentley/imodeljs-native";
import { _nativeDb, ECSqlStatement, InstanceProps } from "../../core-backend";
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

  before(async () => {
    // Get a Test iModel
    IModelTestUtils.registerTestBimSchema();
    iModelDb = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await iModelDb.importSchemas([schemaPathname]);
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

  it.only("should properly read an Element and deserialize it", async () => {
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
      row: iModelDb[_nativeDb].getInstance({
        id: elementId,
        classId: classId!,
        serializationMethod: InstanceSerializationMethod.BeJsNapi,
        useJsNames: true,
        classIdsToClassNames: true,
        abbreviateBlobs: false
      }),
    };

    // Deserialize the element
    const classDef = iModelDb.getJsClass<typeof Element>(classFullName);
    const elementProps = classDef.deserialize(rawInstance);

    const element = iModelDb.elements.getElement(elementId);

    // Verify the element was deserialized correctly
    expect(elementProps).to.not.be.undefined;
    expect(elementProps.classFullName).to.equal(element.classFullName);
    expect(elementProps.id).to.equal(element.id);
    expect(elementProps.code).to.deep.equal(element.code);
    expect(elementProps.model).to.equal(element.model);
    expect(elementProps.parent).to.equal(element.parent);
  });

  it.only("should properly serialize an Element again", async () => {
    const classDef = iModelDb.getJsClass<typeof Element>(testElementProps.classFullName);
    const instance = classDef.serialize(testElementProps);

    expect(instance).to.not.be.undefined;
  });

});
