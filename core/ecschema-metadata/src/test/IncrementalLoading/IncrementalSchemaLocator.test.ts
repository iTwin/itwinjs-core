/* eslint-disable @typescript-eslint/naming-convention */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaProps } from "../../Deserialization/JsonProps";
import { SchemaInfo } from "../../Interfaces";
import { SchemaKey } from "../../SchemaKey";
import { SchemaContext } from "../../Context";
import { IncrementalSchemaLocater } from "../../IncrementalLoading/IncrementalSchemaLocater";
import { SchemaMatchType } from "../../ECObjects";
import { ECSchemaNamespaceUris } from "../../Constants";
import { Schema } from "../../Metadata/Schema";

class TestSchemaLocater extends IncrementalSchemaLocater {
  public async loadSchemaInfos(_context: SchemaContext): Promise<Iterable<SchemaInfo>> {
    throw new Error("Implementation will be provided by the test.");
  }
  public override async loadSchema(schemaInfo: SchemaInfo, context: SchemaContext): Promise<Schema> {
    return super.loadSchema(schemaInfo, context);
  }
  public async getSchemaPartials(_schemaKey: SchemaKey): Promise<[SchemaProps, ...SchemaProps[]] | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
  public async getSchemaJson(_schemaKey: SchemaKey, _context: SchemaContext): Promise<SchemaProps | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
  public async supportPartialSchemaLoading(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe("IncrementalSchemaLocater Tests", () => {
  let context: SchemaContext;
  let locater: TestSchemaLocater;

  beforeEach(() => {
    vi.restoreAllMocks();
    locater = new TestSchemaLocater();
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("get schema info, same context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, context);
    expect(schemaInfoA).toBeDefined();
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, context);
    expect(schemaInfoB).toBeDefined();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("get schema info, different context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoA).toBeDefined();
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoB).toBeDefined();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("locate valid schema with multiple references", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyA.name,
        version: schemaKeyA.version.toString(),
        alias: "SchemaA",
        description: "Test description",
        references: [
          { name: schemaKeyB.name, version: schemaKeyB.version.toString() },
          { name: schemaKeyC.name, version: schemaKeyC.version.toString() }
        ]
      },
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyB.name,
        version: schemaKeyB.version.toString(),
        alias: "SchemaB",
        references: []
      },
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyC.name,
        version: schemaKeyC.version.toString(),
        alias: "SchemaC",
        references: [
          { name: schemaKeyB.name, version: schemaKeyB.version.toString() }
        ]
      },
    ]);

    const schemaA = await context.getSchema(schemaKeyA, SchemaMatchType.Exact);
    expect(schemaA).toBeDefined();
    expect(schemaA).has.nested.property("description", "Test description");
    expect(schemaA).has.nested.property("schemaKey.name", "SchemaA");
    expect(schemaA).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
    expect(schemaA).has.nested.property("references").satisfies((refs: any) => {
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaB"));
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaC"));
      return true;
    });

    const schemaC = await context.getSchema(schemaKeyC, SchemaMatchType.Exact);
    expect(schemaC).toBeDefined();
    expect(schemaC).has.nested.property("schemaKey.name", "SchemaC");
    expect(schemaC).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
    expect(schemaC).has.nested.property("references").satisfies((refs: any) => {
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaB"));
      return true;
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("getSchema called multiple times for same schema", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaD" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaD"
    }]);

    // locater should not cache the schema.
    const spy = vi.spyOn(locater, "loadSchema");
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("getSchema, wait till resolved, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    vi.spyOn(locater, "getSchemaJson").mockResolvedValue({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        "Category": {
          schemaItemType: "EntityClass",
          name: "Category",
          label: "This is Category",
        }
      }
    });

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");

    await schema!.loadingController!.wait();

    expect(schema).toBeDefined();
    expect(schema).to.be.equal(schema);
    await expect(schema!.getEntityClass("Category")).resolves.toBeDefined();
  });

  it("getSchema, wait till resolved, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    vi.spyOn(locater, "getSchemaJson").mockResolvedValue({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        "Category": {
          schemaItemType: "EntityClass",
          name: "Category",
          baseClass: "SchemaA.BadBaseClass",
        }
      }
    } as any);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");

    await expect(schema!.loadingController!.wait()).rejects.toThrow("Unable to locate SchemaItem SchemaA.BadBaseClass.");
  });

  it("getSchema synchronously, returns undefined", () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    expect(context.getSchemaSync(schemaKey)).toBeUndefined();
  });

  it("getSchema which does not exist, returns undefined", async () => {
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([]);

    const schemaKey = new SchemaKey("DoesNotExist");
    const result = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(result);
  });

  it("getSchema, full version, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaD" }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaD", 1, 1, 2), SchemaMatchType.Exact, context);
    expect(schema).toBeUndefined();
  });

  it("getSchema, latest, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 2, 0, 2);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).toBeUndefined();
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).toBeDefined();
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaA" }]);
    vi.spyOn(locater, "getSchemaPartials").mockResolvedValue([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).toBeUndefined();
  });

  it("getSchema, partial schema loading is not supported, fallback to full schema load.", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    vi.spyOn(locater, "loadSchemaInfos").mockResolvedValue([{ schemaKey, references: [], alias: "SchemaD" }]);
    vi.spyOn(locater, "supportPartialSchemaLoading").mockResolvedValue(false);
    const getJsonSpy = vi.spyOn(locater, "getSchemaJson").mockResolvedValue({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaD"
    });

    // locater should not cache the schema.
    const getPartialSpy = vi.spyOn(locater, "getSchemaPartials");
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);

    expect(getPartialSpy).not.toHaveBeenCalled();
    expect(getJsonSpy).toHaveBeenCalledTimes(1);
  });
});
