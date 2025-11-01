import { ECClass, Schema, SchemaContext, SchemaInfo, SchemaItem, SchemaItemKey,
  SchemaItemType, SchemaJsonLocater, SchemaKey, SchemaMatchType, SchemaProps, WithSchemaKey }
  from "@itwin/ecschema-metadata";
import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { IModelIncrementalSchemaLocater } from "../../IModelIncrementalSchemaLocater";

import oldConfiguration from "../assets/IncrementalSchemaLocater/configs/old.config";
import simpleConfiguration from "../assets/IncrementalSchemaLocater/configs/simple.config";
import { IncrementalTestHelper } from "./utils/IncrementalTestHelper";

chai.use(chaiAsPromised);

function parseSchemaItemKey(itemKey: string): SchemaItemKey {
  const [schemaName, itemName] = SchemaItem.parseFullName(itemKey);
  const schemaKey = SchemaKey.parseString(`${schemaName}.0.0.0`);
  return new SchemaItemKey(itemName, schemaKey);
}

describe("Incremental Schema Loading", function () {
  describe ("Simple iModel Incremental Loading Tests", () => {
    let testSchemaKey: SchemaKey;
    let testSchemaConfiguration: any;

    before("Setup", async function () {
      await IncrementalTestHelper.setup();
      testSchemaConfiguration = simpleConfiguration.schemas[0];
      testSchemaKey = new SchemaKey(testSchemaConfiguration.name, 1, 0, 0);
      await IncrementalTestHelper.importSchema(testSchemaKey);

    });

    after(async () => {
      await IncrementalTestHelper.close();
    });

    const iModelSchemaJsonLocater = new SchemaJsonLocater((schemaName) => {
      return IncrementalTestHelper.iModel.getSchemaProps(schemaName) as SchemaProps;
    });

    it("Get SchemaInfo (json props - iModel)", async () => {
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(iModelSchemaJsonLocater);

      const schemaInfo = await schemaContext.getSchemaInfo(testSchemaKey, SchemaMatchType.Exact) as SchemaInfo;
      expect(schemaInfo).to.be.not.undefined;
      expect(schemaInfo).to.have.nested.property("schemaKey.name", testSchemaKey.name);

      expect(schemaInfo).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      expect(schemaInfo).to.have.property("references").to.satisfy((refs: WithSchemaKey[]) => {
        for (const ref of refs) {
          expect(testSchemaConfiguration.references, `Could not find referenced schema: ${ref.schemaKey.name}`).to.include(ref.schemaKey.name);
        }
        return true;
      });
    });

    it("Get SchemaInfo (incremental - backend)", async () => {
      const locater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel, { loadPartialSchemaOnly: true });

      const schemaContext = new SchemaContext();
      schemaContext.addLocater(locater);

      const schemaInfo = await schemaContext.getSchemaInfo(testSchemaKey, SchemaMatchType.Exact) as SchemaInfo;
      expect(schemaInfo).to.be.not.undefined;
      expect(schemaInfo).to.have.nested.property("schemaKey.name", testSchemaKey.name);

      expect(schemaInfo).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      expect(schemaInfo).to.have.property("references").to.satisfy((refs: WithSchemaKey[]) => {
        for (const ref of refs) {
          expect(testSchemaConfiguration.references, `Could not find referenced schema: ${ref.schemaKey.name}`).to.include(ref.schemaKey.name);
        }
        return true;
      });
    });

    it("Get Schema with item stubs (incremental - backend)", async () => {
      const locater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel, { loadPartialSchemaOnly: true });
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(locater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);
      expect(schema).to.have.property("description", testSchemaConfiguration.description);
      expect(schema).to.have.property("label", testSchemaConfiguration.label);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      const items = [...schema.getItems()];
      expect(items).to.have.a.lengthOf(testSchemaConfiguration.itemCount);

      for (const checkStub of testSchemaConfiguration.checkStubs) {
        const item = await schema.lookupItem(checkStub.item);
        expect(item).to.be.not.undefined;
        const props = item!.toJSON();
        for (const [propertyName, propertyValue] of Object.entries(checkStub.properties)) {
          expect(props).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
        }
      }
    });

    it("Get Schema with class hierarchy (json props - iModel)", async () => {
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(iModelSchemaJsonLocater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      const derivedClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.derivedClass);
      const derivedClass = await schemaContext.getSchemaItem(derivedClassKey) as ECClass;
      expect(derivedClass, `${derivedClassKey.fullName} was not found`).to.be.not.undefined;

      const baseClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.baseClass);
      const baseClass = await schemaContext.getSchemaItem(baseClassKey) as ECClass;
      expect(baseClass, `${baseClassKey.fullName} was not found`).to.be.not.undefined;

      const isDerivedFrom = await derivedClass.is(baseClass);
      expect(isDerivedFrom, `${derivedClass.name} is not derived from ${baseClass.name}`).to.be.true;
    });

    it("Get Schema with class hierarchy (incremental - backend)", async () => {
      const locater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel, { loadPartialSchemaOnly: true });
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(locater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      const derivedClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.derivedClass);
      const derivedClass = await schemaContext.getSchemaItem(derivedClassKey) as ECClass;
      expect(derivedClass, `${derivedClassKey.fullName} was not found`).to.be.not.undefined;

      const baseClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.baseClass);
      const baseClass = await schemaContext.getSchemaItem(baseClassKey) as ECClass;
      expect(baseClass, `${baseClassKey.fullName} was not found`).to.be.not.undefined;

      const isDerivedFrom = await derivedClass.is(baseClass);
      expect(isDerivedFrom, `${derivedClass.name} is not derived from ${baseClass.name}`).to.be.true;
    });

    it("Get Schema full schema stack (json props - iModel)", async () => {
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(iModelSchemaJsonLocater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }
    });

    it("Get Schema full schema stack (incremental - backend)", async () => {
      const locater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel);
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(locater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      // Old meta profile fallback queries will not have a controller initialized.
      if (schema.loadingController)
        await schema.loadingController.wait();

      const items = [...schema.getItems()];
      expect(items).to.have.a.lengthOf(testSchemaConfiguration.itemCount);

      for (const checkItem of testSchemaConfiguration.checkFullLoad) {
        const item = await schema.lookupItem(checkItem.item);
        expect(item).to.be.not.undefined;

        const itemProps = item!.toJSON();
        for (const [propertyName, propertyValue] of Object.entries(checkItem.properties)) {
          expect(itemProps).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
        }
      }
    });
  });

  describe("Old Schema profile in iModel Tests", () => {
    let testSchemaKey: SchemaKey;
    let testSchemaConfiguration: any;

    const resolveSchemaKey = async (schemaName: string): Promise<SchemaKey> => {
      const schemaFullName = (await IncrementalTestHelper.getSchemaNames()).find((name) => name.startsWith(schemaName));
      if (schemaFullName === undefined) {
        throw new Error(`Test schema '${schemaName}' not found`);
      }
      return SchemaKey.parseString(schemaFullName);
    }

    before("Setup", async function () {
      await IncrementalTestHelper.setup(oldConfiguration.bimFile);
      testSchemaConfiguration = oldConfiguration.schemas[0];
      testSchemaKey = await resolveSchemaKey(testSchemaConfiguration.name);
    });

    after(async () => {
      await IncrementalTestHelper.close();
    });

    it("Incremental Loading still succeeds.", async () => {
      const locater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel);
      const schemaContext = new SchemaContext();
      schemaContext.addLocater(locater);

      const schema = await schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      // Old meta profile fallback queries will not have a controller initialized.
      if (schema.loadingController)
        await schema.loadingController.wait();

      const items = [...schema.getItems()];
      expect(items).to.have.a.lengthOf(testSchemaConfiguration.itemCount);

      for (const checkItem of testSchemaConfiguration.checkFullLoad) {
        const item = await schema.lookupItem(checkItem.item);
        expect(item).to.be.not.undefined;

        const itemProps = item!.toJSON();
        for (const [propertyName, propertyValue] of Object.entries(checkItem.properties)) {
          expect(itemProps).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
        }
      }
    });
  });

  describe("Old Schema ECXmlVersion in iModel Tests", () => {
    const testSchemaKey: SchemaKey = new SchemaKey("Schema___Test_6");
    const bimName = "OldECXmlVersionIModel.bim";

    before("Setup", async function () {
      await IncrementalTestHelper.setup(bimName);
    });

    after(async () => {
      await IncrementalTestHelper.close();
    });

    it("Incremental Loading matches json.", async () => {
      let schemaContext = new SchemaContext();
      const schemaJsonLocater = new SchemaJsonLocater((schemaName) => IncrementalTestHelper.iModel.getSchemaProps(schemaName));
      schemaContext.addLocater(schemaJsonLocater);
      const schemaJson = await schemaContext.getSchema(testSchemaKey) as Schema;

      schemaContext = new SchemaContext();
      const incrementalSchemaLocater = new IModelIncrementalSchemaLocater(IncrementalTestHelper.iModel);
      schemaContext.addLocater(incrementalSchemaLocater);
      const incrementalSchema = await schemaContext.getSchema(testSchemaKey) as Schema;

      expect(incrementalSchema).to.have.property("name", schemaJson.name);
      expect(incrementalSchema).to.have.property("references").to.have.a.lengthOf(schemaJson.references.length);

      if (incrementalSchema.loadingController)
        await incrementalSchema.loadingController.wait();

      const itemsJson = [...schemaJson.getItems()];
      const incrementalItems = [...incrementalSchema.getItems()];
      expect(incrementalItems).to.have.a.lengthOf(itemsJson.length);

      for (const checkItem of itemsJson) {
        const item = await incrementalSchema.lookupItem(checkItem.name);
        expect(item).to.be.not.undefined;

        const itemProps = item!.toJSON();
        for (const [propertyName, propertyValue] of Object.entries(checkItem.toJSON())) {
          expect(itemProps).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
        }
      }
    });
  });
});
