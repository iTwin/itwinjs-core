/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IncrementalSchemaLocater } from "../IncrementalSchemaLocater";
import { IncrementalSchemaLoader } from "../IncrementalSchemaLoader";
import { SchemaContext } from "../Context";
import { ECVersion, SchemaKey } from "../SchemaKey";
import { Schema, SchemaInfo, SchemaMatchType, SchemaProps } from "../ecschema-metadata";
import * as sinon from "sinon";

const $schema = "https://dev.bentley.com/json_schemas/ec/32/ecschema";

class TestSchemaLoader extends IncrementalSchemaLoader {
  public override async loadSchemaInfos(_context: SchemaContext): Promise<Iterable<SchemaInfo>> {
    throw new Error("Implementation will be provided by the test.");
  }
  public override async getSchemaPartials(_schemaKey: SchemaKey): Promise<[SchemaProps, ...Partial<SchemaProps>[]] | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
  public override async getSchemaJson(_schemaKey: SchemaKey, _context: SchemaContext): Promise<SchemaProps | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
}

describe("IncrementalSchemaLocater tests: ", () => {
  let locater: IncrementalSchemaLocater;
  let context: SchemaContext;
  let schemaLoader: TestSchemaLoader;

  beforeEach(() => {
    schemaLoader = new TestSchemaLoader();
    locater = new IncrementalSchemaLocater(schemaLoader);
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("get schema info, same context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = sinon.stub(schemaLoader, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{schemaKey: schemaKeyB}, {schemaKey: schemaKeyC}], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{schemaKey: schemaKeyB}], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, context);
    expect(schemaInfoA).to.not.be.undefined;
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, context);
    expect(schemaInfoB).to.not.be.undefined;

    expect(spy.callCount).to.be.equal(1);
  });

  it("get schema info, different context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = sinon.stub(schemaLoader, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{schemaKey: schemaKeyB}, {schemaKey: schemaKeyC}], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{schemaKey: schemaKeyB}], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoA).to.not.be.undefined;
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoB).to.not.be.undefined;

    expect(spy.callCount).to.be.equal(2);
  });

  it("locate valid schema with multiple references", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{schemaKey: schemaKeyB}, {schemaKey: schemaKeyC}], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{schemaKey: schemaKeyB}], alias: "SchemaC" },
    ]);

    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKeyA.name,
      version: schemaKeyA.version.toString(),
      alias: "SchemaA",
      description: "Test description",
      references: [
        { name: schemaKeyB.name, version: schemaKeyB.version.toString() },
        { name: schemaKeyB.name, version: schemaKeyB.version.toString() }
      ]
    }]);

    const spy = sinon.spy(schemaLoader, "loadSchema");

    const schema = await context.getSchema(schemaKeyA, SchemaMatchType.Exact);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");
    expect(schema).has.nested.property("references").satisfies((refs: Schema[]) => {
      expect(refs).satisfies(() => refs.some((ref) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaB"));
      expect(refs).satisfies(() => refs.some((ref) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaC"));
      return true;
    });

    expect(spy.callCount).to.be.equal(1, "SchemaLoaders loadSchema should only be called once.");
  });

  it("getSchema called multiple times for same schema", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaD" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaD"
    }]);

    // locater should not cache the schema.
    const spy = sinon.spy(schemaLoader, "loadSchema");
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);

    expect(spy.callCount).to.be.equal(2);
  });

  it("getSchema, wait till resolved, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    sinon.stub(schemaLoader, "getSchemaJson").resolves({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        category: {
          schemaItemType: "EntityClass",
          label: "This is Category",
        }
      }
    } as any);

    const resolvePromise = new Promise<Schema>((resolve, reject) => {
      schemaLoader.onSchemaComplete.addListener((value) => {
        value.schemaKey.matches(schemaKey) && resolve(value);
      });
      schemaLoader.onSchemaError.addListener((value, error) => {
        value.schemaKey.matches(schemaKey) && reject(error);
      });
    });

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");

    const resolvedSchema = await resolvePromise;
    expect(resolvedSchema).to.not.be.undefined;
    expect(resolvedSchema). to.be.equal(schema);
    await expect(resolvedSchema.getEntityClass("category")).to.be.eventually.not.undefined;
  });

  it("getSchema, wait till resolved, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    sinon.stub(schemaLoader, "getSchemaJson").resolves({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        category: {
          schemaItemType: "EntityClass",
          name: "Category",
          baseClass: "SchemaA.BadBaseClass",
        }
      }
    } as any);

    const resolvePromise = new Promise<Schema>((resolve, reject) => {
      schemaLoader.onSchemaComplete.addListener((value) => {
        value.schemaKey.matches(schemaKey) && resolve(value);
      });
      schemaLoader.onSchemaError.addListener((value, error) => {
        value.schemaKey.matches(schemaKey) && reject(error);
      });
    });

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");

    await expect(resolvePromise).to.be.rejectedWith("Unable to locate SchemaItem SchemaA.BadBaseClass.");
  });

  it("getSchema synchronously, fails", () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = context.getSchemaSync(schemaKey);
    expect(schema).to.be.undefined;
  });

  it("getSchema which does not exist, returns undefined", async () => {
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([]);

    const schemaKey = new SchemaKey("DoesNotExist");
    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, full version, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaD" }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaD", 1, 1, 2), SchemaMatchType.Exact, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, latest, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 2, 0, 2);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: ECVersion) => v.toString() ==="01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(schemaLoader, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(schemaLoader, "getSchemaPartials").resolves([{
      $schema,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).to.be.undefined;
  });
});
