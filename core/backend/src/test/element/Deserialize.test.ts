import { InstanceSerializationMethod } from "@bentley/imodeljs-native";
import { _nativeDb, ECSqlStatement, RawECInstance } from "../../core-backend";
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
    iModelDb.close();
  });

  afterEach(() => {
    sinon.restore();
  });

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
    const rawInstance: RawECInstance = {
      instance: iModelDb[_nativeDb].getInstance({
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

    // Verify the element was deserialized correctly
    expect(elementProps).to.not.be.undefined;

  });

});
