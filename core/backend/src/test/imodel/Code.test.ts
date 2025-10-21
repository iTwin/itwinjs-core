import { assert, expect } from "chai";
import * as path from "node:path";
import { SnapshotDb } from "../../core-backend";
import { Code, ElementProps } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { Id64 } from "@itwin/core-bentley";

describe("Code insertion tests", () => {
  let imodel: SnapshotDb;

  before(async () => {
    IModelTestUtils.registerTestBimSchema();
    const seedFile = IModelTestUtils.resolveAssetFile("test.bim");
    const snapshotFile = IModelTestUtils.prepareOutputFile("IModel", "test.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(snapshotFile, seedFile);
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchemas([schemaPathname]);
    imodel.saveChanges();
  });

  after(() => {
    imodel.close();
  });

  it("should query a known element by code", () => {
    assert.exists(imodel.elements);
    const code = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const elementId = imodel.elements.queryElementIdByCode(code);
    assert.exists(elementId);
    assert.equal(elementId, "0x1e");
  });

  it("should get undefined when querying an element with a bad code value", () => {
    assert.exists(imodel.elements);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
    const elementId = imodel.elements.queryElementIdByCode(badCode);
    assert.isUndefined(elementId);
  });

  it("should get undefined when querying for an element id with an empty code", () => {
    assert.exists(imodel.elements);
    const emptyCode = Code.createEmpty();
    const elementId = imodel.elements.queryElementIdByCode(emptyCode);
    assert.isUndefined(elementId);
  });

  it("should throw when querying for an element id with a NULL code value", () => {
    assert.exists(imodel.elements);
    expect(() => imodel.elements.queryElementIdByCode({
      spec: "0x10", scope: "0x11",
      value: undefined as any
    })).to.throw("Invalid Code");
  });

  it("should throw when querying for an element id with no spec", () => {
    assert.exists(imodel.elements);
    const noSpecCode = new Code({ spec: "", scope: "0x11", value: "RF1.dgn" });
    const elementId = imodel.elements.queryElementIdByCode(noSpecCode);
    assert.isUndefined(elementId);
  });

  it("should get undefined when querying for an element id with no scope", () => {
    assert.exists(imodel.elements);
    const noScopeCode = new Code({ spec: "0x10", scope: "", value: "RF1.dgn" });
    const elementId = imodel.elements.queryElementIdByCode(noScopeCode);
    assert.isUndefined(elementId);
  });

  it("should fail to insert an element with invalid Code scope", () => {
    assert.exists(imodel.elements);
    const elProps: ElementProps = {
      classFullName: 'BisCore:RepositoryLink',
      code: { scope: "bad scope", spec: "0x10", value: "new code" }, // invalid scope value
      id: '0x1e',
      model: '0x11',
      userLabel: 'RF1.dgn',
      federationGuid: undefined,
    };

    expect(() => imodel.elements.insertElement(elProps)).throws("invalid code scope").to.have.property("metadata");
    elProps.code.scope = "0x34322"; // valid id, but element doesn't exist
    expect(() => imodel.elements.insertElement(elProps)).throws("invalid code scope").to.have.property("metadata");
    elProps.code.scope = undefined as any; // nothing
    expect(() => imodel.elements.insertElement(elProps)).throws("invalid code scope").to.have.property("metadata");
  });

  it("should insert an element with valid Code spec", () => {
    assert.exists(imodel.elements);
    const elProps: ElementProps = {
      classFullName: 'BisCore:RepositoryLink',
      code: { scope: "0x1", spec: "validSpec", value: "new code" },
      id: '0x1e',
      model: '0x11',
      userLabel: 'RF1.dgn',
      federationGuid: undefined,
    };

    const id = imodel.elements.insertElement(elProps);
    assert.exists(id);
    assert.isTrue(Id64.isValidId64(id));
  });

  it("should fail to insert an element with invalid Code spec", () => {
    assert.exists(imodel.elements);
    const elProps: ElementProps = {
      classFullName: 'BisCore:RepositoryLink',
      code: { scope: "0x1", spec: "0x34322", value: "new code" }, // valid id, but element doesn't exist
      id: '0x1e',
      model: '0x11',
      userLabel: 'RF1.dgn',
      federationGuid: undefined,
    };

    expect(() => imodel.elements.insertElement(elProps)).throws("Error inserting element").to.have.property("metadata");
    elProps.code.spec = undefined as any; // nothing
    expect(() => imodel.elements.insertElement(elProps)).throws("Error inserting element").to.have.property("metadata");
  });

  it("should fail to insert an element with an empty Code", () => {
    assert.exists(imodel.elements);
    const elProps: ElementProps = {
      classFullName: 'BisCore:RepositoryLink',
      code: Code.createEmpty(),
      id: '0x1e',
      model: '0x11',
      userLabel: 'RF1.dgn',
      federationGuid: undefined,
    };

    expect(() => imodel.elements.insertElement(elProps)).throws().to.have.property("metadata");
  });

  it("should fail to insert an element with a NULL Code value", () => {
    assert.exists(imodel.elements);
    const elProps: ElementProps = {
      classFullName: 'BisCore:RepositoryLink',
      code: { scope: "0x1", spec: "bad spec" },
      id: '0x1e',
      model: '0x11',
      userLabel: 'RF1.dgn',
      federationGuid: undefined,
    };

    expect(() => imodel.elements.insertElement(elProps)).throws().to.have.property("metadata");
  });
});