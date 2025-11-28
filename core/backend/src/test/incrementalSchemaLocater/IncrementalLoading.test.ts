import { ECClass, Schema, SchemaInfo, SchemaItem, SchemaItemKey,
  SchemaItemType, SchemaKey, SchemaMatchType, WithSchemaKey }
  from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { IModelIncrementalSchemaLocater } from "../../IModelIncrementalSchemaLocater";
import { TestContext } from "./TestContext";

import oldConfiguration from "../assets/IncrementalSchemaLocater/configs/old.config";
import simpleConfiguration from "../assets/IncrementalSchemaLocater/configs/simple.config";

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

function parseSchemaItemKey(itemKey: string): SchemaItemKey {
  const [schemaName, itemName] = SchemaItem.parseFullName(itemKey);
  const schemaKey = SchemaKey.parseString(`${schemaName}.0.0.0`);
  return new SchemaItemKey(itemName, schemaKey);
}

describe("Incremental Schema Loading", function () {
  describe ("Simple iModel Incremental Loading Tests", () => {
    const testSchemaConfiguration = simpleConfiguration.schemas[0];
    const testSchemaKey = new SchemaKey(testSchemaConfiguration.name, 1, 0, 0);

    it("should get schema info", async () => {
      await using env = await TestContext.create();
      await env.importAssetSchema(testSchemaKey);

      const schemaInfo = await env.schemaContext.getSchemaInfo(testSchemaKey, SchemaMatchType.Exact) as SchemaInfo;
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

    it("should get schema with item stubs", async () => {
      await using env = await TestContext.create();
      await env.importAssetSchema(testSchemaKey);

      const schema = await env.schemaContext.getSchema(testSchemaKey) as Schema;
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

    it("should get schema with class stubs with hierarchy", async () => {
      await using env = await TestContext.create();
      await env.importAssetSchema(testSchemaKey);

      const schema = await env.schemaContext.getSchema(testSchemaKey) as Schema;

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      const derivedClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.derivedClass);
      const derivedClass = await env.schemaContext.getSchemaItem(derivedClassKey) as ECClass;
      expect(derivedClass, `${derivedClassKey.fullName} was not found`).to.be.not.undefined;

      const baseClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.baseClass);
      const baseClass = await env.schemaContext.getSchemaItem(baseClassKey) as ECClass;
      expect(baseClass, `${baseClassKey.fullName} was not found`).to.be.not.undefined;

      const isDerivedFrom = await derivedClass.is(baseClass);
      expect(isDerivedFrom, `${derivedClass.name} is not derived from ${baseClass.name}`).to.be.true;
    });

    it("should get schema full schema stack", async () => {
      await using env = await TestContext.create();
      await env.importAssetSchema(testSchemaKey);

      const schema = await env.schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      // Wait till schemas are fully loaded to be comparable.
      // TODO: remove this check when issue #1763 is fixed.
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
    it("should succeed with incremental loading fallback.", async () => {
      await using env = await TestContext.create({
        bimFile: oldConfiguration.bimFile,
      });

      const resolveSchemaKey = async (schemaName: string): Promise<SchemaKey> => {
        const schemaFullName = (await env.getSchemaNames()).find((name) => name.startsWith(schemaName));
        if (schemaFullName === undefined) {
          throw new Error(`Test schema '${schemaName}' not found`);
        }
        return SchemaKey.parseString(schemaFullName);
      }

      const testSchemaConfiguration = oldConfiguration.schemas[0];
      const testSchemaKey = await resolveSchemaKey(testSchemaConfiguration.name);

      const schema = await env.schemaContext.getSchema(testSchemaKey) as Schema;
      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

      expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
      for (const item of schema.getItems()) {
        expect(item).to.have.property("name");
        expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
      }

      expect(schema).to.be.not.undefined;
      expect(schema).to.have.property("name", testSchemaKey.name);

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

  describe("Test Incremental Loading setup", () => {
    it("schema context should not have an instance of incremental schema locater if loading is disabled", async () => {
      await using env = await TestContext.create({ incrementalSchemaLoading: "disabled" });
      const locaters = env.iModel.schemaContext.locaters;
      const incrementalLocater = locaters.find((locater) => locater instanceof IModelIncrementalSchemaLocater);
      expect(incrementalLocater).to.be.undefined;
    });

    it("schema context should have an instance of incremental schema locater if loading is enabled", async () => {
      await using env = await TestContext.create({ incrementalSchemaLoading: "enabled" });
      const locaters = env.iModel.schemaContext.locaters;
      const incrementalLocater = locaters.find((locater) => locater instanceof IModelIncrementalSchemaLocater);
      expect(incrementalLocater).to.be.not.undefined;
    });

    it("schema context should not have an instance of incremental schema locater if loading is not specified", async () => {
      await using env = await TestContext.create({ incrementalSchemaLoading: undefined });
      const locaters = env.iModel.schemaContext.locaters;
      const incrementalLocater = locaters.find((locater) => locater instanceof IModelIncrementalSchemaLocater);
      expect(incrementalLocater).to.be.undefined;
    });
  });
});
