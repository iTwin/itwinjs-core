import { _nativeDb, ECSqlStatement, InstanceProps } from "../../core-backend";
import { Element, GeometricElement3d } from "../../Element";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "node:path";
import * as sinon from "sinon";
import { DbResult, Id64String } from "@itwin/core-bentley";
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

  function getInstanceKey(id: Id64String, baseClass: "Element" | "Model") {
    return iModelDb.withPreparedStatement(`SELECT ec_className(ECClassId, 's:c') FROM Bis.${baseClass} WHERE ECInstanceId=?`, (stmt: ECSqlStatement) => {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        return { id, classFullName: stmt.getValue(0).getString() };
      }
      throw new Error(`Element with id ${id} not found`);
    });
  }

  it.only("GeometricElement3d", async () => {
    const key = getInstanceKey("0x38", "Element");
    const rawInstance: InstanceProps = {
      iModel: iModelDb,
      row: iModelDb[_nativeDb].readInstance(key, { useJsNames: true, wantGeometry: true }),
    };

    // Deserialize the element
    const classDef = iModelDb.getJsClass<typeof Element>(key.classFullName);
    const elementProps = classDef.deserialize(rawInstance);

    const element = iModelDb.elements.getElement<GeometricElement3d>({ id: key.id, wantGeometry: true });
    console.log(element);
    console.log(elementProps);

  });

  it("SpatialViewDefinitionUsesModelSelector", async () => {
    const key = getInstanceKey("0x34", "Element");
    const rawInstance: InstanceProps = {
      iModel: iModelDb,
      row: iModelDb[_nativeDb].readInstance(key, { useJsNames: true }),
    };

    // Deserialize the element
    const classDef = iModelDb.getJsClass<typeof Element>(key.classFullName);
    const elementProps = classDef.deserialize(rawInstance);

    const element = iModelDb.elements.getElement(key.id);

    // Verify the element was deserialized correctly
    expect(elementProps).to.not.be.undefined;
    expect(elementProps.classFullName).to.equal(element.classFullName);
    expect(elementProps.id).to.equal(element.id);
    expect(elementProps.code).to.deep.equal(element.code);
    expect(elementProps.model).to.equal(element.model);
    expect(elementProps.parent).to.equal(element.parent);
  });



});
