import { assert, expect } from "chai";
import * as path from "node:path";
import { SnapshotDb } from "../../core-backend";
import { Code, ElementProps } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { Id64 } from "@itwin/core-bentley";

describe("Code Tests", () => {
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

  describe("Code Query Tests", () => {
    it("should query an element by code", () => {
      assert.exists(imodel.elements);
      const code = new Code({ scope: "0x11", spec: "0x10", value: "RF1.dgn" });
      const elementId = imodel.elements.queryElementIdByCode(code);
      assert.exists(elementId);
      assert.equal(elementId, "0x1e");
    });

    it("should get undefined when querying an element with a bad code value", () => {
      assert.exists(imodel.elements);
      const badCode = new Code({ scope: "0x11", spec: "0x10", value: "RF1_does_not_exist.dgn" });
      const elementId = imodel.elements.queryElementIdByCode(badCode);
      assert.isUndefined(elementId);
    });

    it("should get undefined when querying an element with an empty code", () => {
      assert.exists(imodel.elements);
      const emptyCode = Code.createEmpty();
      const elementId = imodel.elements.queryElementIdByCode(emptyCode);
      assert.isUndefined(elementId);
    });

    it("should get undefined when querying an element with a non-breaking space value", () => {
      assert.exists(imodel.elements);
      const nonBreakingSpaceCode = new Code({ scope: "0x11", spec: "0x10", value: "\xa0" });
      const elementId = imodel.elements.queryElementIdByCode(nonBreakingSpaceCode);
      assert.isUndefined(elementId);
    });

    it("should throw when querying an element with a NULL value", () => {
      assert.exists(imodel.elements);
      const nullValueCode = { scope: "0x11", spec: "0x10", value: undefined as any };
      expect(() => imodel.elements.queryElementIdByCode(nullValueCode)).to.throw("Invalid Code");
    });

    it("should throw when querying an element with an empty spec", () => {
      assert.exists(imodel.elements);
      const noSpecCode = new Code({ scope: "0x11", spec: "", value: "RF1.dgn" });
      expect(() => imodel.elements.queryElementIdByCode(noSpecCode)).to.throw("Invalid CodeSpec");
    });

    it("should get undefined when querying an element with a whitespace string spec", () => {
      assert.exists(imodel.elements);
      const whitespaceCode = { scope: "0x11", spec: " ", value: "RF1.dgn" };
      const elementId = imodel.elements.queryElementIdByCode(whitespaceCode);
      assert.isUndefined(elementId);
    });

    it("should get undefined when querying an element with a non-breaking space spec", () => {
      assert.exists(imodel.elements);
      const nonBreakingSpaceCode = { scope: "0x11", spec: "\xa0", value: "RF1.dgn" };
      const elementId = imodel.elements.queryElementIdByCode(nonBreakingSpaceCode);
      assert.isUndefined(elementId);
    });

    it("should throw when querying an element with a bad spec", () => {
      assert.exists(imodel.elements);
      const badSpecCode = new Code({ scope: "0x11", spec: "not a real id", value: "RF1.dgn" });
      expect(() => imodel.elements.queryElementIdByCode(badSpecCode)).to.throw("Invalid CodeSpec");
    });

    it("should get undefined when querying for an element id with no scope", () => {
      assert.exists(imodel.elements);
      const noScopeCode = new Code({ scope: "", spec: "0x10", value: "RF1.dgn" });
      const elementId = imodel.elements.queryElementIdByCode(noScopeCode);
      assert.isUndefined(elementId);
    });

    it("should get undefined when querying for an element id with non-breaking space scope", () => {
      assert.exists(imodel.elements);
      const nonBreakingSpaceCode = new Code({ scope: "\xa0", spec: "0x10", value: "RF1.dgn" });
      const elementId = imodel.elements.queryElementIdByCode(nonBreakingSpaceCode);
      assert.isUndefined(elementId);
    });

    it("should get undefined when querying for an element id with a bad scope", () => {
      assert.exists(imodel.elements);
      const badScopeCode = new Code({ scope: "not a real id", spec: "0x10", value: "RF1.dgn" });
      const elementId = imodel.elements.queryElementIdByCode(badScopeCode);
      assert.isUndefined(elementId);
    });
  });

  describe("Code Insertion Tests", () => {
    it("should insert an element with valid Code", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "new code" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id = imodel.elements.insertElement(elProps);
      assert.exists(id);
      assert.isTrue(Id64.isValidId64(id));
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

    it("should insert and trim an element with a code value with trailing spaces", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "new code trailing space test " },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id = imodel.elements.insertElement(elProps);
      assert.exists(id);
      assert.isTrue(Id64.isValidId64(id));

      const queryResult = imodel.elements.queryElementIdByCode({ scope: "0x1", spec: "0x10", value: "new code trailing space test " });
      assert.exists(queryResult);
      assert.equal(queryResult, id);
      const element = imodel.elements.getElement(id);
      assert.equal(element.code.value, "new code trailing space test");

      const elProps2: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "new code trailing space test2\xa0" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id2 = imodel.elements.insertElement(elProps2);
      assert.exists(id2);
      assert.isTrue(Id64.isValidId64(id2));

      const queryResult2 = imodel.elements.queryElementIdByCode({ scope: "0x1", spec: "0x10", value: "new code trailing space test2\xa0" });
      assert.exists(queryResult2);
      assert.equal(queryResult2, id2);
      const element2 = imodel.elements.getElement(id2);
      assert.equal(element2.code.value, "new code trailing space test2");
    });

    it("should insert and trim an element with a code value that is only trailing spaces", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: " " },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id = imodel.elements.insertElement(elProps);
      assert.exists(id);
      assert.isTrue(Id64.isValidId64(id));

      const element = imodel.elements.getElement(id);
      assert.equal(element.code.value, "");

      const elProps2: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "\xa0" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id2 = imodel.elements.insertElement(elProps2);
      assert.exists(id2);
      assert.isTrue(Id64.isValidId64(id2));

      const element2 = imodel.elements.getElement(id2);
      assert.equal(element2.code.value, "");
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
      // TODO: Non-ID values currently do not throw an error. This should be caught in TS
      // elProps.code.spec = "not a spec in the model"; // not an id
      // expect(() => imodel.elements.insertElement(elProps)).throws("Error inserting element").to.have.property("metadata");
      // elProps.code.spec = undefined as any; // nothing
      // expect(() => imodel.elements.insertElement(elProps)).throws("Error inserting element").to.have.property("metadata");
    });

    it("should fail to insert an element with a duplicate valid code", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "new code duplicate test" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      const id = imodel.elements.insertElement(elProps);
      assert.exists(id);
      assert.isTrue(Id64.isValidId64(id));

      const elProps2: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "new code duplicate test" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };

      expect(() => imodel.elements.insertElement(elProps2)).throws("Error inserting element").to.have.property("metadata");
    });
  });

  describe("Code Update Tests", () => {
    it("should update an element code to a valid code", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "newcode update" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };
      const elementId = imodel.elements.insertElement(elProps);
      const element = imodel.elements.getElement(elementId);
      assert.equal(element.code.value, elProps.code.value);
      assert.equal(element.code.spec, elProps.code.spec);
      assert.equal(element.code.scope, elProps.code.scope);

      let newCode = new Code({ scope: "0x1", spec: "0x10", value: "UpdatedValue.dgn2" });
      element.code = newCode;
      element.update();

      const updatedElement = imodel.elements.getElement(elementId);
      assert.equal(updatedElement.code.value, newCode.value);
      assert.equal(updatedElement.code.spec, newCode.spec);
      assert.equal(updatedElement.code.scope, newCode.scope);

      newCode = new Code({ scope: "0x12", spec: "0x11", value: "UpdatedValue.dgn2" });
      element.code = newCode;
      element.update();

      const updatedElement2 = imodel.elements.getElement(elementId);
      assert.equal(updatedElement2.code.value, newCode.value);
      assert.equal(updatedElement2.code.spec, newCode.spec);
      assert.equal(updatedElement2.code.scope, newCode.scope);
    });

    it("should fail to update an element code to a duplicate valid code", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "newcode3" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };
      const elementId = imodel.elements.insertElement(elProps);
      const element = imodel.elements.getElement(elementId);
      assert.equal(element.code.value, elProps.code.value);
      assert.equal(element.code.spec, elProps.code.spec);
      assert.equal(element.code.scope, elProps.code.scope);

      const elProps2: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "newcode32" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };
      const elementId2 = imodel.elements.insertElement(elProps2);
      const element2 = imodel.elements.getElement(elementId2);
      assert.equal(element2.code.value, elProps2.code.value);
      assert.equal(element2.code.spec, elProps2.code.spec);
      assert.equal(element2.code.scope, elProps2.code.scope);

      element.code = element2.code;
      expect(() => element.update()).to.throw("Error updating element").to.have.property("metadata");
    });

    it("should update an element code with edge case code values", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "newcode4" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };
      const elementId = imodel.elements.insertElement(elProps);
      const element = imodel.elements.getElement(elementId);
      assert.equal(element.code.value, elProps.code.value);
      assert.equal(element.code.spec, elProps.code.spec);
      assert.equal(element.code.scope, elProps.code.scope);

      let newCode = new Code({ scope: "0x1", spec: "0x10", value: "" }); // empty value
      element.code = newCode;
      element.update();

      const updatedElement = imodel.elements.getElement(elementId);
      assert.equal(updatedElement.code.value, newCode.value);
      assert.equal(updatedElement.code.spec, newCode.spec);
      assert.equal(updatedElement.code.scope, newCode.scope);

      newCode = new Code({ scope: "0x1", spec: "0x10", value: "validcodeagain" }); // reset the code
      element.code = newCode;
      element.update();

      newCode = new Code({ scope: "0x1", spec: "0x11" }); // NULL value
      newCode.value = undefined as any;
      element.code = newCode;
      element.update();

      const updatedElement2 = imodel.elements.getElement(elementId);
      assert.equal(updatedElement2.code.value, "");
      assert.equal(updatedElement2.code.spec, newCode.spec);
      assert.equal(updatedElement2.code.scope, newCode.scope);

      newCode = Code.createEmpty(); // Empty Code
      element.code = newCode;
      element.update();

      const updatedElement3 = imodel.elements.getElement(elementId);
      assert.equal(updatedElement3.code.value, newCode.value);
      assert.equal(updatedElement3.code.spec, newCode.spec);
      assert.equal(updatedElement3.code.scope, newCode.scope);

      newCode = new Code({ scope: "0x1", spec: "0x11", value: "\xa0" }); // non-breaking space value
      newCode.value = undefined as any;
      element.code = newCode;
      element.update();

      const updatedElement4 = imodel.elements.getElement(elementId);
      assert.equal(updatedElement4.code.value, "");
      assert.equal(updatedElement4.code.spec, newCode.spec);
      assert.equal(updatedElement4.code.scope, newCode.scope);
    });

    it("should fail to update an element code with an invalid code scope", () => {
      assert.exists(imodel.elements);
      const elProps: ElementProps = {
        classFullName: 'BisCore:RepositoryLink',
        code: { scope: "0x1", spec: "0x10", value: "newcode5" },
        id: '0x1e',
        model: '0x11',
        userLabel: 'RF1.dgn',
        federationGuid: undefined,
      };
      const elementId = imodel.elements.insertElement(elProps);
      const element = imodel.elements.getElement(elementId);
      assert.equal(element.code.value, elProps.code.value);
      assert.equal(element.code.spec, elProps.code.spec);
      assert.equal(element.code.scope, elProps.code.scope);

      let newCode = new Code({ scope: "", spec: "0x10", value: "newcode5" }); // empty scope
      element.code = newCode;
      expect(() => element.update()).to.throw("Error updating element").to.have.property("metadata");

      const updatedElement = imodel.elements.getElement(elementId);
      assert.equal(updatedElement.code.value, elProps.code.value);
      assert.equal(updatedElement.code.spec, elProps.code.spec);
      assert.equal(updatedElement.code.scope, elProps.code.scope);

      newCode = new Code({ scope: "not a real id", spec: "0x10", value: "newcode5" }); // bad id
      element.code = newCode;
      expect(() => element.update()).to.throw("Error updating element").to.have.property("metadata");

      const updatedElement2 = imodel.elements.getElement(elementId);
      assert.equal(updatedElement2.code.value, elProps.code.value);
      assert.equal(updatedElement2.code.spec, elProps.code.spec);
      assert.equal(updatedElement2.code.scope, elProps.code.scope);
    });
  });
});