/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AnyECType, AnyProperty, ECClass, EntityClass, Enumeration, Format, KindOfQuantity, PropertyCategory,
  RelationshipClass, Schema, SchemaContext, Unit,
} from "@itwin/ecschema-metadata";
import { AnyDiagnostic, DiagnosticCategory, DiagnosticType } from "../../Validation/Diagnostic";
import { ISchemaChanges, SchemaChanges } from "../../Validation/SchemaChanges";
import { SchemaCompareCodes } from "../../Validation/SchemaCompareDiagnostics";
import { SchemaComparer } from "../../Validation/SchemaComparer";
import { ISchemaCompareReporter } from "../../Validation/SchemaCompareReporter";

/* eslint-disable @typescript-eslint/naming-convention */

class TestSchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
  public get diagnostics(): AnyDiagnostic[] {
    let diagnostics: AnyDiagnostic[] = [];
    for (const changes of this.changes) {
      diagnostics = diagnostics.concat(changes.allDiagnostics);
    }

    return diagnostics;
  }
}

describe("Schema comparison tests", () => {
  let reporter: TestSchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  const schemaAJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaA",
    version: "1.2.3",
    alias: "a",
    label: "labelA",
    description: "descriptionA",
  };

  function getSchemaJsonWithItems(schemaJson: any, items: any) {
    return {
      ...schemaJson,
      items: {
        ...items,
      },
    };
  }

  function getItemJsonWithUnits(additionalItems: any): any {
    return getSchemaJsonWithItems(schemaAJson, {
      ...additionalItems,
      PhenomenonA: {
        schemaItemType: "Phenomenon",
        definition: "A",
      },
      PhenomenonB: {
        schemaItemType: "Phenomenon",
        definition: "B",
      },
      UnitSystemA: {
        schemaItemType: "UnitSystem",
      },
      UnitSystemB: {
        schemaItemType: "UnitSystem",
      },
      UnitA: {
        schemaItemType: "Unit",
        unitSystem: "SchemaA.UnitSystemA",
        phenomenon: "SchemaA.PhenomenonA",
        definition: "A",
        numerator: 1,
        offset: 1,
        denominator: 1,
      },
      UnitB: {
        schemaItemType: "Unit",
        unitSystem: "SchemaA.UnitSystemA",
        phenomenon: "SchemaA.PhenomenonA",
        definition: "B",
      },
      UnitC: {
        schemaItemType: "Unit",
        unitSystem: "SchemaA.UnitSystemA",
        phenomenon: "SchemaA.PhenomenonA",
        definition: "C",
      },
    });
  }

  function validateDiagnostic(diagnostic: AnyDiagnostic, expectedCode: string, expectedType: DiagnosticType, expectedObject: AnyECType, expectedArgs: any[], expectedSchema: Schema) {
    expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
    expect(diagnostic.code).to.equal(expectedCode);
    expect(diagnostic.diagnosticType).to.equal(expectedType);
    expect(diagnostic.ecDefinition).to.equal(expectedObject);
    expect(diagnostic.messageArgs).to.eql(expectedArgs);
    expect(diagnostic.schema).to.eql(expectedSchema);
  }

  beforeEach(async () => {
    reporter = new TestSchemaCompareReporter();
    contextA = new SchemaContext();
    contextB = new SchemaContext();
  });

  describe("Schema delta tests", () => {
    it("Different name, diagnostic reported", async () => {
      const schemaBJson = { ...schemaAJson, ...{ name: "SchemaB" } };
      const schemaA = await Schema.fromJson(schemaAJson, contextA);
      const schemaB = await Schema.fromJson(schemaBJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaDelta, DiagnosticType.Schema, schemaA, ["schemaKey", schemaA.schemaKey.toString(), schemaB.schemaKey.toString()], schemaA);
    });

    it("Different version, diagnostic reported", async () => {
      const schemaBJson = { ...schemaAJson, ...{ version: "1.2.4" } };
      const schemaA = await Schema.fromJson(schemaAJson, contextA);
      const schemaB = await Schema.fromJson(schemaBJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaDelta, DiagnosticType.Schema, schemaA, ["schemaKey", schemaA.schemaKey.toString(), schemaB.schemaKey.toString()], schemaA);
    });

    it("Different alias, diagnostic reported", async () => {
      const schemaBJson = { ...schemaAJson, ...{ alias: "b" } };
      const schemaA = await Schema.fromJson(schemaAJson, contextA);
      const schemaB = await Schema.fromJson(schemaBJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaDelta, DiagnosticType.Schema, schemaA, ["alias", "a", "b"], schemaA);
    });

    it("Different label, diagnostic reported", async () => {
      const schemaBJson = { ...schemaAJson, ...{ label: "labelB" } };
      const schemaA = await Schema.fromJson(schemaAJson, contextA);
      const schemaB = await Schema.fromJson(schemaBJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaDelta, DiagnosticType.Schema, schemaA, ["label", "labelA", "labelB"], schemaA);
    });

    it("Different description, diagnostic reported", async () => {
      const schemaBJson = { ...schemaAJson, ...{ description: "descriptionB" } };
      const schemaA = await Schema.fromJson(schemaAJson, contextA);
      const schemaB = await Schema.fromJson(schemaBJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaDelta, DiagnosticType.Schema, schemaA, ["description", "descriptionA", "descriptionB"], schemaA);
    });

    it("Different references, diagnostic reported for each schema", async () => {
      const aRefJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchemaA",
        version: "1.0.0",
        alias: "rs",
      };
      const bRefJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchemaB",
        version: "2.0.0",
        alias: "rs",
      };
      const refSchemaA = await Schema.fromJson(aRefJson, contextA);
      const refSchemaB = await Schema.fromJson(bRefJson, contextB);
      const aJson = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "1.0.0" }] };
      const bJson = { ...schemaAJson, references: [{ name: "RefSchemaB", version: "2.0.0" }] };
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaReferenceMissing, DiagnosticType.Schema, schemaA, [refSchemaA], schemaA);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.SchemaReferenceMissing, DiagnosticType.Schema, schemaB, [refSchemaB], schemaB);
    });

    it("Different reference versions, diagnostic reported for each schema", async () => {
      const aRefJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchemaA",
        version: "1.0.0",
        alias: "rs",
      };
      const a2RefJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchemaA",
        version: "2.0.0",
        alias: "rs",
      };
      const refSchemaA = await Schema.fromJson(aRefJson, contextA);
      const refSchemaA2 = await Schema.fromJson(a2RefJson, contextB);
      const aJson = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "1.0.0" }] };
      const a2Json = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "2.0.0" }] };
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(a2Json, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaReferenceDelta, DiagnosticType.Schema, schemaA, [refSchemaA, "01.00.00", "02.00.00"], schemaA);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.SchemaReferenceDelta, DiagnosticType.Schema, schemaB, [refSchemaA2, "02.00.00", "01.00.00"], schemaB);
    });

    it("Reference missing from Schema B, diagnostic reported", async () => {
      const aRefJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchemaA",
        version: "1.0.0",
        alias: "rs",
      };
      const refSchemaA = await Schema.fromJson(aRefJson, contextA);
      const aJson = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "1.0.0" }] };
      const bJson = schemaAJson;
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaReferenceMissing, DiagnosticType.Schema, schemaA, [refSchemaA], schemaA);
    });
  });

  it("Same references, diagnostic not reported", async () => {
    const aRefJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchemaA",
      version: "1.0.0",
      alias: "rs",
    };
    await Schema.fromJson(aRefJson, contextA);
    await Schema.fromJson(aRefJson, contextB);
    const aJson = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "1.0.0" }] };
    const bJson = { ...schemaAJson, references: [{ name: "RefSchemaA", version: "1.0.0" }] };
    const schemaA = await Schema.fromJson(aJson, contextA);
    const schemaB = await Schema.fromJson(bJson, contextB);

    const comparer = new SchemaComparer(reporter);
    await comparer.compareSchemas(schemaA, schemaB);

    expect(reporter.diagnostics.length).to.equal(0, "Expected no differences.");
  });

  describe("SchemaItem delta tests", () => {
    it("Different SchemaItems, diagnostic reported for each schema", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const bItems = {
        TestClassB: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemB = await schemaB.getItem("TestClassB") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const result = reporter.diagnostics.filter((d) => d.code === SchemaCompareCodes.SchemaItemMissing);
      validateDiagnostic(result[0], SchemaCompareCodes.SchemaItemMissing, DiagnosticType.SchemaItem, itemA, [], itemA.schema);
      validateDiagnostic(result[1], SchemaCompareCodes.SchemaItemMissing, DiagnosticType.SchemaItem, itemB, [], itemB.schema);
    });

    it("Same SchemaItems, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      await schemaB.getItem("TestClassB") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no differences.");
    });

    it("Different label, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          label: "labelA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          label: "labelB",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaItemDelta, DiagnosticType.SchemaItem, itemA, ["label", "labelA", "labelB"], itemA.schema);
    });

    it("Undefined and empty label are considered equivalent, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          label: "",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different description, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          description: "descriptionA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          description: "descriptionB",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaItemDelta, DiagnosticType.SchemaItem, itemA, ["description", "descriptionA", "descriptionB"], itemA.schema);
    });

    it("Different SchemaItemType, diagnostic reported", async () => {
      const aItems = {
        AppliesTo: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          modifier: "None",
        },
      };
      const bItems = {
        AppliesTo: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "Mixin",
          modifier: "None",
          appliesTo: "SchemaA.AppliesTo",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.SchemaItemDelta, DiagnosticType.SchemaItem, itemA, ["schemaItemType", "EntityClass", "Mixin"], itemA.schema);
    });

    it("Same SchemaItemType, diagnostic not reported", async () => {
      const aItems = {
        AppliesTo: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          modifier: "None",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaB.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no differences.");
    });

    it("SchemaItem B does not exist, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const bItems = {
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "label" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "description" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "modifier" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "schemaItemType" ? true : false)).to.not.be.undefined;
    });
  });

  describe("ECClass delta tests", () => {
    it("Different modifier, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          modifier: "Sealed",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.ClassDelta, DiagnosticType.SchemaItem, itemA, ["modifier", "Sealed", "None"], itemA.schema);
    });

    it("Same modifier, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          modifier: "Sealed",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      await schemaB.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no differences.");
    });

    it("Different baseClass, Schema B has undefined base class, diagnostic reported", async () => {
      const aItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
        },
      };
      const bItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.BaseClassDelta, DiagnosticType.SchemaItem, itemA, [await itemA.baseClass, undefined], itemA.schema);
    });

    it("Different baseClass, Schema A has undefined base class, diagnostic reported", async () => {
      const aItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const bItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemB = await schemaB.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.BaseClassDelta, DiagnosticType.SchemaItem, itemA, [undefined, await itemB.baseClass], itemA.schema);
    });

    it("Different baseClass, diagnostic reported", async () => {
      const aItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        BaseClassB: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
        },
      };
      const bItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        BaseClassB: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassB",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const baseClassA = await schemaA.getItem("BaseClassA");
      const baseClassB = await schemaB.getItem("BaseClassB");

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.BaseClassDelta, DiagnosticType.SchemaItem, itemA, [baseClassA, baseClassB], itemA.schema);
    });

    it("Same baseClass, diagnostic not reported", async () => {
      const aItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
        },
      };
      const bItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Class B does not exist, all diagnostics reported", async () => {
      const aItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          baseClass: "SchemaA.BaseClassA",
          modifier: "Sealed",
        },
      };
      const bItems = {
        BaseClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const classA = await schemaA.getItem("TestClassA") as EntityClass;
      const baseClass = await classA.baseClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "label" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "description" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "modifier" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "schemaItemType" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === baseClass ? true : false)).to.not.be.undefined;
    });
  });

  describe("Property delta tests", () => {
    it("Property B not found, undefined Property A properties not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(5, "Expected 5 differences.");
      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.PropertyMissing ? true : false)).to.not.be.undefined;

      const propChanges = reporter.changes[0].classChanges.get("TestClassA")!.propertyChanges.get("PropertyA");
      let propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "isReadOnly" ? true : false);
      expect(propChange?.toString()).to.equal("IsReadOnly: false -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "type" ? true : false);
      expect(propChange?.toString()).to.equal("Type: PrimitiveProperty -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "primitiveType" ? true : false);
      expect(propChange?.toString()).to.equal("PrimitiveType: string -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "priority" ? true : false);
      expect(propChange?.toString()).to.equal("Priority: 0 -> undefined");
    });

    it("Property B not found, PrimitiveArray property, all diagnostics reported", async () => {
      const aItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestKindOfQuantity: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
              label: "labelA",
              description: "test description",
              minOccurs: 1,
              maxOccurs: 2,
              isReadOnly: false,
              priority: 1,
              category: "SchemaA.CategoryA",
              kindOfQuantity: "SchemaA.TestKindOfQuantity",
            },
          ],
        },
      };
      const bItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        TestKindOfQuantity: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(11, "Expected 11 differences.");
      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.PropertyMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "label" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "description" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "isReadOnly" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "priority" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "category" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "type" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "minOccurs" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "maxOccurs" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "primitiveType" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "kindOfQuantity" ? true : false)).to.not.be.undefined;

      const propChanges = reporter.changes[0].classChanges.get("TestClassA")!.propertyChanges.get("PropertyA");

      let propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "label" ? true : false);
      expect(propChange?.toString()).to.equal("Label: labelA -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "description" ? true : false);
      expect(propChange?.toString()).to.equal("Description: test description -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "isReadOnly" ? true : false);
      expect(propChange?.toString()).to.equal("IsReadOnly: false -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "priority" ? true : false);
      expect(propChange?.toString()).to.equal("Priority: 1 -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "category" ? true : false);
      expect(propChange?.toString()).to.equal("Category: SchemaA.CategoryA -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "kindOfQuantity" ? true : false);
      expect(propChange?.toString()).to.equal("KindOfQuantity: SchemaA.TestKindOfQuantity -> undefined");
    });

    it("Property B not found , Enumeration property, all diagnostics reported", async () => {
      const aItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        EnumB: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "SchemaA.EnumA",
            },
          ],
        },
      };
      const bItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        EnumB: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(5, "Expected 5 differences.");
      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.PropertyMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "isReadOnly" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "priority" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "type" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "enumeration" ? true : false)).to.not.be.undefined;

      const propChanges = reporter.changes[0].classChanges.get("TestClassA")!.propertyChanges.get("PropertyA");

      let propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "label" ? true : false);
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "type" ? true : false);
      expect(propChange?.toString()).to.equal("Type: PrimitiveProperty -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "isReadOnly" ? true : false);
      expect(propChange?.toString()).to.equal("IsReadOnly: false -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "priority" ? true : false);
      expect(propChange?.toString()).to.equal("Priority: 0 -> undefined");
      propChange = propChanges!.propertyValueChanges.find((p) => p.diagnostic && p.diagnostic.messageArgs && p.diagnostic.messageArgs[0] === "enumeration" ? true : false);
      expect(propChange?.toString()).to.equal("Enumeration: SchemaA.EnumA -> undefined");
    });

    it("Property B not found, Navigation property, all diagnostics reported", async () => {
      const aItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        RelationshipB: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "forward",
            },
          ],
        },
      };
      const bItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        RelationshipB: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(6, "Expected 6 differences.");
      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.PropertyMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "isReadOnly" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "priority" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "type" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "direction" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "relationshipClass" ? true : false)).to.not.be.undefined;
    });

    it("Different label, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "labelA",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "labelB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["label", "labelA", "labelB"], itemA.schema);
    });

    it("Undefined and empty label are considered equivalent, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              label: "",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different description, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              description: "descriptionA",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              description: "descriptionB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["description", "descriptionA", "descriptionB"], itemA.schema);
    });

    it("Different isReadOnly, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              isReadOnly: true,
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              isReadOnly: false,
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["isReadOnly", true, false], itemA.schema);
    });

    it("Different priority, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              priority: 1,
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              priority: 2,
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["priority", 1, 2], itemA.schema);
    });

    it("Different category, diagnostic reported", async () => {
      const aItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        CategoryB: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              category: "SchemaA.CategoryA",
            },
          ],
        },
      };
      const bItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        CategoryB: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              category: "SchemaA.CategoryB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["category", "SchemaA.CategoryA", "SchemaA.CategoryB"], itemA.schema);
    });

    it("Schema A category undefined, diagnostic reported", async () => {
      const aItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              category: "SchemaA.CategoryA",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["category", undefined, "SchemaA.CategoryA"], itemA.schema);
    });

    it("Schema B category undefined, diagnostic reported", async () => {
      const aItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              category: "SchemaA.CategoryA",
            },
          ],
        },
      };
      const bItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 1,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["category", "SchemaA.CategoryA", undefined], itemA.schema);
    });

    it("Different kindOfQuantity, diagnostic reported", async () => {
      const aItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        KindOfQuantityB: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SchemaA.KindOfQuantityA",
            },
          ],
        },
      };
      const bItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        KindOfQuantityB: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SchemaA.KindOfQuantityB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["kindOfQuantity", "SchemaA.KindOfQuantityA", "SchemaA.KindOfQuantityB"], itemA.schema);
    });

    it("Schema A kindOfQuantity undefined, diagnostic reported", async () => {
      const aItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SchemaA.KindOfQuantityA",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["kindOfQuantity", undefined, "SchemaA.KindOfQuantityA"], itemA.schema);
    });

    it("Schema B kindOfQuantity undefined, diagnostic reported", async () => {
      const aItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SchemaA.KindOfQuantityA",
            },
          ],
        },
      };
      const bItems = {
        TestUnitSystem: {
          schemaItemType: "UnitSystem",
        },
        TestPhenom: {
          schemaItemType: "Phenomenon",
          definition: "LENGTH(1)",
        },
        TestUnit: {
          schemaItemType: "Unit",
          label: "test",
          phenomenon: "SchemaA.TestPhenom",
          unitSystem: "SchemaA.TestUnitSystem",
          definition: "Test",
        },
        KindOfQuantityA: {
          schemaItemType: "KindOfQuantity",
          label: "SomeDisplayLabel",
          relativeError: 1.234,
          persistenceUnit: "SchemaA.TestUnit",
          presentationUnits: [
            "SchemaA.DefaultReal",
          ],
        },
        DefaultReal: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 6,
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["kindOfQuantity", "SchemaA.KindOfQuantityA", undefined], itemA.schema);
    });

    it("Different propertyType, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["type", "PrimitiveProperty", "PrimitiveArrayProperty"], itemA.schema);
    });

    it("Different array minOccurs, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
              minOccurs: 0,
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
              minOccurs: 1,
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["minOccurs", 0, 1], itemA.schema);
    });

    it("Different array maxOccurs, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
              maxOccurs: 0,
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveArrayProperty",
              typeName: "string",
              maxOccurs: 1,
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["maxOccurs", 0, 1], itemA.schema);
    });

    it("Different enumeration, diagnostic reported", async () => {
      const aItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        EnumB: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "SchemaA.EnumA",
            },
          ],
        },
      };
      const bItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        EnumB: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "SchemaA.EnumB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["enumeration", "SchemaA.EnumA", "SchemaA.EnumB"], itemA.schema);
    });

    it("Same enumeration, diagnostic not reported", async () => {
      const aItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "SchemaA.EnumA",
            },
          ],
        },
      };
      const bItems = {
        EnumA: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "A",
              value: "A",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "SchemaA.EnumA",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different navigation property relationship, diagnostic reported", async () => {
      const aItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        RelationshipB: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "forward",
            },
          ],
        },
      };
      const bItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        RelationshipB: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipB",
              direction: "forward",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["relationshipClass", "SchemaA.RelationshipA", "SchemaA.RelationshipB"], itemA.schema);
    });

    it("Different navigation property direction, diagnostic reported", async () => {
      const aItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "forward",
            },
          ],
        },
      };
      const bItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "backward",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["direction", "Forward", "Backward"], itemA.schema);
    });

    it("Same navigation property relationship, diagnostic not reported", async () => {
      const aItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "forward",
            },
          ],
        },
      };
      const bItems = {
        RelationshipA: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "NavigationProperty",
              relationshipName: "SchemaA.RelationshipA",
              direction: "forward",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different primitive type, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "int",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["primitiveType", "string", "int"], itemA.schema);
    });

    it("Different struct class, diagnostic reported", async () => {
      const aItems = {
        StructA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        StructB: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "StructProperty",
              typeName: "SchemaA.StructA",
            },
          ],
        },
      };
      const bItems = {
        StructA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        StructB: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "StructProperty",
              typeName: "SchemaA.StructB",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyDelta, DiagnosticType.Property, itemAProp, ["structClass", "SchemaA.StructA", "SchemaA.StructB"], itemA.schema);
    });

    it("Same struct class, diagnostic not reported", async () => {
      const aItems = {
        StructA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "StructProperty",
              typeName: "SchemaA.StructA",
            },
          ],
        },
      };
      const bItems = {
        StructA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
        TestClassA: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "PropertyA",
              type: "StructProperty",
              typeName: "SchemaA.StructA",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      await schemaA.getItem("TestClassA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different properties, diagnostic reported for each schema", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyA",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "PropertyB",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemB = await schemaB.getItem("TestClassA") as ECClass;
      const itemAProp = await itemA.getProperty("PropertyA") as AnyProperty;
      const itemBProp = await itemB.getProperty("PropertyB") as AnyProperty;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const result = reporter.diagnostics.filter((d) => d.code === SchemaCompareCodes.PropertyMissing);
      validateDiagnostic(result[0], SchemaCompareCodes.PropertyMissing, DiagnosticType.Property, itemAProp, [], itemA.schema);
      validateDiagnostic(result[1], SchemaCompareCodes.PropertyMissing, DiagnosticType.Property, itemBProp, [], itemB.schema);
    });
  });

  describe("EntityClass delta tests", () => {
    it("Different mixins, diagnostic reported for each schema", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
        MixinB: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinB"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
        MixinB: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemB = await schemaB.getItem("TestClassA") as ECClass;
      const mixinA = await schemaA.getItem("MixinA") as ECClass;
      const mixinB = await schemaB.getItem("MixinB") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EntityMixinMissing, DiagnosticType.SchemaItem, itemA, [mixinA], itemA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.EntityMixinMissing, DiagnosticType.SchemaItem, itemB, [mixinB], itemB.schema);
    });

    it("Same mixins, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no differences.");
    });

    it("No SchemaItem B, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const bItems = {};
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const mixin = await schemaA.getItem("MixinA");

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "label" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "description" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "modifier" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "schemaItemType" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === mixin ? true : false)).to.not.be.undefined;
    });
  });

  describe("Mixin delta tests", () => {
    it("Different appliesTo, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        TestClassB: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
        MixinB: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassB",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        TestClassB: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassB",
        },
        MixinB: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassB",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("MixinA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.MixinDelta, DiagnosticType.SchemaItem, itemA, ["appliesTo", "SchemaA.TestClassA", "SchemaA.TestClassB"], itemA.schema);
    });

    it("Same appliesTo, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Mixin B does not exist, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
        MixinB: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          mixins: ["SchemaA.MixinA"],
        },
        MixinA: {
          schemaItemType: "Mixin",
          appliesTo: "SchemaA.TestClassA",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "appliesTo" ? true : false)).to.not.be.undefined;
    });
  });

  describe("RelationshipClass delta tests", () => {
    it("No Schema B RelationshipClass, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "strength" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "strengthDirection" ? true : false)).to.not.be.undefined;
    });

    it("Different strength, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestRelationship") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipDelta, DiagnosticType.SchemaItem, itemA, ["strength", "Referencing", "Embedding"], itemA.schema);
    });

    it("Same strength, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different strengthDirection, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "backward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestRelationship") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipDelta, DiagnosticType.SchemaItem, itemA, ["strengthDirection", "Forward", "Backward"], itemA.schema);
    });

    it("Same strengthDirection, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });
  });

  describe("RelationshipConstraint delta tests", () => {
    function getConstraintJson(sourceAndTarget: any): any {
      return getSchemaJsonWithItems(schemaAJson, {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestClassB: {
          schemaItemType: "EntityClass",
        },
        TestClassC: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          ...sourceAndTarget,
        },
      });
    }

    it("No Schema B RelationshipConstraint, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "LabelA",
            polymorphic: false,
            constraintClasses: [
              "SchemaA.TestClassA",
            ],
          },
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const relationship = await schemaA.getItem("TestRelationship") as RelationshipClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.source && d.code === SchemaCompareCodes.RelationshipConstraintClassMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.target && d.code === SchemaCompareCodes.RelationshipConstraintClassMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.source && d.messageArgs && d.messageArgs[0] === "multiplicity" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.target && d.messageArgs && d.messageArgs[0] === "multiplicity" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.source && d.messageArgs && d.messageArgs[0] === "polymorphic" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.target && d.messageArgs && d.messageArgs[0] === "polymorphic" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.source && d.messageArgs && d.messageArgs[0] === "roleLabel" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.target && d.messageArgs && d.messageArgs[0] === "roleLabel" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.source && d.messageArgs && d.messageArgs[0] === "abstractConstraint" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === relationship.target && d.messageArgs && d.messageArgs[0] === "abstractConstraint" ? true : false)).to.not.be.undefined;
    });

    it("Different multiplicities, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..1)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..1)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["multiplicity", "(0..*)", "(0..1)"], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["multiplicity", "(0..1)", "(0..*)"], relA.schema);
    });

    it("Different roleLabel, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelB",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelB",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["roleLabel", "LabelA", "LabelB"], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["roleLabel", "LabelB", "LabelA"], relA.schema);
    });

    it("Different polymorphic, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: true,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: true,
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["polymorphic", true, false], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["polymorphic", false, true], relA.schema);
    });

    it("Different abstractConstraint, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassB",
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassB",
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["abstractConstraint", "SchemaA.TestClassA", "SchemaA.TestClassB"], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["abstractConstraint", "SchemaA.TestClassB", "SchemaA.TestClassA"], relA.schema);
    });

    it("Schema A abstractConstraints undefined, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: undefined,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: undefined,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["abstractConstraint", undefined, "SchemaA.TestClassA"], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["abstractConstraint", undefined, "SchemaA.TestClassA"], relA.schema);
    });

    it("Schema B abstractConstraints undefined, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          abstractConstraint: "SchemaA.TestClassA",
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.source, ["abstractConstraint", "SchemaA.TestClassA", undefined], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintDelta, DiagnosticType.RelationshipConstraint, relA.target, ["abstractConstraint", "SchemaA.TestClassA", undefined], relA.schema);
    });

    it("Different constraints, diagnostic reported for each constraint", async () => {
      const aItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassB",
          ],
        },
      };
      const bItems = {
        source: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassC",
          ],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "LabelA",
          polymorphic: false,
          constraintClasses: [
            "SchemaA.TestClassA",
            "SchemaA.TestClassC",
          ],
        },
      };
      const aJson = getConstraintJson(aItems);
      const bJson = getConstraintJson(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const relA = await schemaA.getItem("TestRelationship") as RelationshipClass;
      const relB = await schemaB.getItem("TestRelationship") as RelationshipClass;
      const classB = await schemaA.getItem("TestClassB");
      const classC = await schemaB.getItem("TestClassC");

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(4, "Expected 4 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.RelationshipConstraintClassMissing, DiagnosticType.RelationshipConstraint, relA.source, [classB], relA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.RelationshipConstraintClassMissing, DiagnosticType.RelationshipConstraint, relA.target, [classB], relA.schema);
      validateDiagnostic(reporter.diagnostics[2], SchemaCompareCodes.RelationshipConstraintClassMissing, DiagnosticType.RelationshipConstraint, relB.source, [classC], relB.schema);
      validateDiagnostic(reporter.diagnostics[3], SchemaCompareCodes.RelationshipConstraintClassMissing, DiagnosticType.RelationshipConstraint, relB.target, [classC], relB.schema);
    });
  });

  describe("CustomAttributeClass delta tests", () => {
    it("No Schema B CustomAttributeClass, all diagnostics reported", async () => {
      const aItems = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema, AnyProperty",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, {});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === "appliesTo" ? true : false)).to.not.be.undefined;
    });

    it("Different containerType, diagnostic reported", async () => {
      const aItems = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema, AnyProperty",
        },
      };
      const bItems = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestCustomAttribute") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.CustomAttributeClassDelta, DiagnosticType.SchemaItem, itemA, ["appliesTo", "Schema, AnyProperty", "AnyClass"], itemA.schema);
    });
  });

  describe("CustomAttributeInstance delta tests", () => {
    it("No Schema B CustomAttributeContainer, all diagnostics reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "SchemaA.CustomAttributeA",
              ShowClasses: true,
            },
          ],
        },
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const bItems = {
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.code === SchemaCompareCodes.CustomAttributeInstanceClassMissing ? true : false)).to.not.be.undefined;
    });

    it("Same CA instances, diagnostic not reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "SchemaA.CustomAttributeA",
              ShowClasses: true,
            },
          ],
        },
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "SchemaA.CustomAttributeA",
              ShowClasses: true,
            },
          ],
        },
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different CA instances, diagnostic reported", async () => {
      const aItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "SchemaA.CustomAttributeA",
              ShowClasses: true,
            },
          ],
        },
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
        CustomAttributeB: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const bItems = {
        TestClassA: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "SchemaA.CustomAttributeB",
              ShowClasses: true,
            },
          ],
        },
        CustomAttributeA: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
        CustomAttributeB: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestClassA") as ECClass;
      const itemB = await schemaB.getItem("TestClassA") as ECClass;
      const caA = itemA.customAttributes!.get("SchemaA.CustomAttributeA");
      const caB = itemB.customAttributes!.get("SchemaA.CustomAttributeB");

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.CustomAttributeInstanceClassMissing, DiagnosticType.CustomAttributeContainer, itemA, [caA], itemA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.CustomAttributeInstanceClassMissing, DiagnosticType.CustomAttributeContainer, itemB, [caB], itemB.schema);
    });
  });

  describe("Enumeration delta tests", () => {
    it("No Schema B Enumeration, all diagnostics reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: true,
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, {});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const enumeration = await schemaA.getItem("TestEnumeration") as Enumeration;
      const enumerator = enumeration.enumerators[0];

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === enumeration && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === enumeration && d.messageArgs && d.messageArgs[0] === "type" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === enumeration && d.messageArgs && d.messageArgs[0] === "isStrict" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === enumerator && d.messageArgs[1] === "description" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === enumerator && d.messageArgs[1] === "label" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.messageArgs && d.messageArgs[0] === enumerator && d.messageArgs[1] === "value" ? true : false)).to.not.be.undefined;
    });

    it("Different type, diagnostic reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "EnumA",
              value: 1,
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EnumerationDelta, DiagnosticType.SchemaItem, itemA, ["type", "string", "int"], itemA.schema);
    });

    it("Different isStrict, diagnostic reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: true,
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: false,
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EnumerationDelta, DiagnosticType.SchemaItem, itemA, ["isStrict", true, false], itemA.schema);
    });

    it("Different enumerators missing, diagnostic reported for each schema", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumB",
              value: "B",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as Enumeration;
      const itemB = await schemaB.getItem("TestEnumeration") as Enumeration;

      const diagA = reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.code === SchemaCompareCodes.EnumeratorMissing ? true : false);
      const diagB = reporter.diagnostics.find((d) => d.ecDefinition === itemB && d.code === SchemaCompareCodes.EnumeratorMissing ? true : false);

      expect(diagA).to.not.be.undefined;
      expect(diagB).to.not.be.undefined;
      validateDiagnostic(diagA!, SchemaCompareCodes.EnumeratorMissing, DiagnosticType.SchemaItem, itemA, [itemA.enumerators[0]], itemA.schema);
      validateDiagnostic(diagB!, SchemaCompareCodes.EnumeratorMissing, DiagnosticType.SchemaItem, itemB, [itemB.enumerators[0]], itemB.schema);
    });

    it("Different enumerator description, diagnostic reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
              description: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
              description: "B",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as Enumeration;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EnumeratorDelta, DiagnosticType.SchemaItem, itemA, [itemA.enumerators[0], "description", "A", "B"], itemA.schema);
    });

    it("Different enumerator label, diagnostic reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
              label: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
              label: "B",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as Enumeration;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EnumeratorDelta, DiagnosticType.SchemaItem, itemA, [itemA.enumerators[0], "label", "A", "B"], itemA.schema);
    });

    it("Undefined and empty label are considered equivalent, diagnostic not reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
              label: "",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.length).to.equal(0, "Expected no difference.");
    });

    it("Different enumerator value, diagnostic reported", async () => {
      const aItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "A",
            },
          ],
        },
      };
      const bItems = {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumA",
              value: "B",
            },
          ],
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("TestEnumeration") as Enumeration;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.EnumeratorDelta, DiagnosticType.SchemaItem, itemA, [itemA.enumerators[0], "value", "A", "B"], itemA.schema);
    });
  });

  describe("KOQ delta tests", () => {
    it("No Schema B KOQ, all diagnostics reported", async () => {
      const aItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitA",
          presentationUnits: [
            "SchemaA.FormatA",
          ],
        },
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const koq = await schemaA.getItem("KoqA") as KindOfQuantity;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === koq && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === koq && d.messageArgs && d.messageArgs[0] === "relativeError" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === koq && d.messageArgs && d.messageArgs[0] === "persistenceUnit" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === koq && d.code === SchemaCompareCodes.PresentationUnitMissing ? true : false)).to.not.be.undefined;
    });

    it("Different relativeError, diagnostic reported", async () => {
      const aItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitA",
        },
      };
      const bItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 2,
          persistenceUnit: "SchemaA.UnitA",
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("KoqA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.KoqDelta, DiagnosticType.SchemaItem, itemA, ["relativeError", 1, 2], itemA.schema);
    });

    it("Different persistenceUnit, diagnostic reported", async () => {
      const aItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitA",
        },
      };
      const bItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitB",
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("KoqA") as ECClass;
      const unitA = await schemaA.getItem("UnitA") as ECClass;
      const unitB = await schemaB.getItem("UnitB") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.KoqDelta, DiagnosticType.SchemaItem, itemA, ["persistenceUnit", unitA.fullName, unitB.fullName], itemA.schema);
    });

    it("Different presentation units, diagnostic reported for each schema", async () => {
      const aItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitA",
          presentationUnits: [
            "SchemaA.FormatA",
            "SchemaA.FormatB",
          ],
        },
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
        FormatB: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
        FormatC: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const bItems = {
        KoqA: {
          schemaItemType: "KindOfQuantity",
          relativeError: 1,
          persistenceUnit: "SchemaA.UnitA",
          presentationUnits: [
            "SchemaA.FormatB",
            "SchemaA.FormatC",
          ],
        },
        FormatB: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
        FormatC: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("KoqA") as ECClass;
      const itemB = await schemaB.getItem("KoqA") as ECClass;
      const unitA = await schemaA.getItem("FormatA");
      const unitC = await schemaB.getItem("FormatC");

      const diagA = reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.code === SchemaCompareCodes.PresentationUnitMissing ? true : false);
      const diagB = reporter.diagnostics.find((d) => d.ecDefinition === itemB && d.code === SchemaCompareCodes.PresentationUnitMissing ? true : false);

      expect(diagA).to.not.be.undefined;
      expect(diagB).to.not.be.undefined;
      validateDiagnostic(diagA!, SchemaCompareCodes.PresentationUnitMissing, DiagnosticType.SchemaItem, itemA, [unitA], itemA.schema);
      validateDiagnostic(diagB!, SchemaCompareCodes.PresentationUnitMissing, DiagnosticType.SchemaItem, itemB, [unitC], itemB.schema);
    });
  });

  describe("PropertyCategory delta tests", () => {
    it("No Schema B PropertyCategory, all diagnostics reported", async () => {
      const aItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          priority: 1,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, {});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const category = await schemaA.getItem("CategoryA") as PropertyCategory;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === category && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === category && d.messageArgs && d.messageArgs[0] === "priority" ? true : false)).to.not.be.undefined;
    });

    it("Different priority, diagnostic reported", async () => {
      const aItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          priority: 1,
        },
      };
      const bItems = {
        CategoryA: {
          schemaItemType: "PropertyCategory",
          priority: 2,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("CategoryA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PropertyCategoryDelta, DiagnosticType.SchemaItem, itemA, ["priority", 1, 2], itemA.schema);
    });
  });

  describe("Format delta tests", () => {
    it("No Schema B Format, all diagnostics reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, {});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const format = await schemaA.getItem("FormatA") as Format;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "roundFactor" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "type" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "precision" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "showSignOption" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "decimalSeparator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "thousandSeparator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "uomSeparator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "stationSeparator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "formatTraits" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "spacer" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === format && d.messageArgs && d.messageArgs[0] === "includeZero" ? true : false)).to.not.be.undefined;
    });

    it("Different roundFactor, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 1,
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          roundFactor: 2,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["roundFactor", 1, 2], itemA.schema);
    });

    it("Different type, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["type", "Decimal", "Fractional"], itemA.schema);
    });

    it("Different precision, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 1,
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          precision: 2,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["precision", 1, 2], itemA.schema);
    });

    it("Different minWidth, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          minWidth: 1,
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          minWidth: 2,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["minWidth", 1, 2], itemA.schema);
    });

    it("Different scientificType, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "scientific",
          scientificType: "Normalized",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "scientific",
          scientificType: "ZeroNormalized",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["scientificType", "Normalized", "ZeroNormalized"], itemA.schema);
    });

    it("Different showSignOption, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          showSignOption: "NoSign",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          showSignOption: "SignAlways",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["showSignOption", "NoSign", "SignAlways"], itemA.schema);
    });

    it("Different decimalSeparator, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          decimalSeparator: "-",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          decimalSeparator: ".",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["decimalSeparator", "-", "."], itemA.schema);
    });

    it("Different thousandSeparator, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          thousandSeparator: "-",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          thousandSeparator: ".",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["thousandSeparator", "-", "."], itemA.schema);
    });

    it("Different uomSeparator, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          uomSeparator: "-",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          uomSeparator: ".",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["uomSeparator", "-", "."], itemA.schema);
    });

    it("Different stationSeparator, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          stationSeparator: "-",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          stationSeparator: ".",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["stationSeparator", "-", "."], itemA.schema);
    });

    it("Different stationOffsetSize, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "station",
          stationOffsetSize: 1,
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "station",
          stationOffsetSize: 2,
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["stationOffsetSize", 1, 2], itemA.schema);
    });

    it("Different formatTraits, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          formatTraits: "keepSingleZero|trailZeroes",
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "decimal",
          formatTraits: "keepSingleZero",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["formatTraits", "TrailZeroes,KeepSingleZero", "KeepSingleZero"], itemA.schema);
    });

    it("Different spacer, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: false,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA" },
            ],
          },
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: false,
            spacer: "B",
            units: [
              { name: "SchemaA.UnitA" },
            ],
          },
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["spacer", "A", "B"], itemA.schema);
    });

    it("Different includeZero, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: true,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA" },
            ],
          },
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: false,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA" },
            ],
          },
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatDelta, DiagnosticType.SchemaItem, itemA, ["includeZero", true, false], itemA.schema);
    });

    it("Different units, diagnostic reported for each schema", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: true,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA" },
            ],
          },
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: true,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitB" },
            ],
          },
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as ECClass;
      const itemB = await schemaB.getItem("FormatA") as ECClass;
      const unitA = await schemaA.getItem("UnitA") as ECClass;
      const unitB = await schemaB.getItem("UnitB") as ECClass;

      expect(reporter.diagnostics.length).to.equal(2, "Expected 2 differences.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.FormatUnitMissing, DiagnosticType.SchemaItem, itemA, [unitA], itemA.schema);
      validateDiagnostic(reporter.diagnostics[1], SchemaCompareCodes.FormatUnitMissing, DiagnosticType.SchemaItem, itemB, [unitB], itemB.schema);
    });

    it("Different unit labels, diagnostic reported", async () => {
      const aItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: true,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA", label: "A" },
            ],
          },
        },
      };
      const bItems = {
        FormatA: {
          schemaItemType: "Format",
          type: "fractional",
          composite: {
            includeZero: true,
            spacer: "A",
            units: [
              { name: "SchemaA.UnitA", label: "B" },
            ],
          },
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("FormatA") as Format;
      const unit = await schemaB.getItem("UnitA");

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitLabelOverrideDelta, DiagnosticType.SchemaItem, itemA, [unit, "A", "B"], itemA.schema);
    });
  });

  describe("Unit delta tests", () => {
    it("No Schema B Unit, only SchemaItemMissing diagnostic reported", async () => {
      const aItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
        UnitSystemA: {
          schemaItemType: "UnitSystem",
        },
        UnitA: {
          schemaItemType: "Unit",
          unitSystem: "SchemaA.UnitSystemA",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
          numerator: 1,
          offset: 1,
          denominator: 1,
        },
      };
      const bItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
        UnitSystemA: {
          schemaItemType: "UnitSystem",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const unit = await schemaA.getItem("UnitA") as Unit;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "phenomenon" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "unitSystem" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "definition" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "numerator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "denominator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === unit && d.messageArgs && d.messageArgs[0] === "offset" ? true : false)).to.not.be.undefined;
    });

    it("Different phenomenon, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].phenomenon = "SchemaA.PhenomenonB";
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["phenomenon", "SchemaA.PhenomenonA", "SchemaA.PhenomenonB"], itemA.schema);
    });

    it("Different unitSystem, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].unitSystem = "SchemaA.UnitSystemB";
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["unitSystem", "SchemaA.UnitSystemA", "SchemaA.UnitSystemB"], itemA.schema);
    });

    it("Different definition, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].definition = "B";
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["definition", "A", "B"], itemA.schema);
    });

    it("Different numerator, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].numerator = 2;
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["numerator", 1, 2], itemA.schema);
    });

    it("Different offset, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].offset = 2;
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["offset", 1, 2], itemA.schema);
    });

    it("Different denominator, diagnostic reported", async () => {
      const bJson = getItemJsonWithUnits({});
      // eslint-disable-next-line dot-notation
      bJson.items["UnitA"].denominator = 2;
      const aJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("UnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.UnitDelta, DiagnosticType.SchemaItem, itemA, ["denominator", 1, 2], itemA.schema);
    });
  });

  describe("InvertedUnit delta tests", () => {
    it("No Schema B InvertedUnit, all diagnostics reported", async () => {
      const aItems = {
        InvertedUnitA: {
          schemaItemType: "InvertedUnit",
          invertsUnit: "SchemaA.UnitA",
          unitSystem: "SchemaA.UnitSystemA",
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits({});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("InvertedUnitA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "invertsUnit" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "unitSystem" ? true : false)).to.not.be.undefined;
    });

    it("Different invertsUnit, diagnostic reported", async () => {
      const aItems = {
        InvertedUnitA: {
          schemaItemType: "InvertedUnit",
          invertsUnit: "SchemaA.UnitA",
          unitSystem: "SchemaA.UnitSystemA",
        },
      };
      const bItems = {
        InvertedUnitA: {
          schemaItemType: "InvertedUnit",
          invertsUnit: "SchemaA.UnitB",
          unitSystem: "SchemaA.UnitSystemA",
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("InvertedUnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.InvertedUnitDelta, DiagnosticType.SchemaItem, itemA, ["invertsUnit", "SchemaA.UnitA", "SchemaA.UnitB"], itemA.schema);
    });

    it("Different unitSystem, diagnostic reported", async () => {
      const aItems = {
        InvertedUnitA: {
          schemaItemType: "InvertedUnit",
          invertsUnit: "SchemaA.UnitA",
          unitSystem: "SchemaA.UnitSystemA",
        },
      };
      const bItems = {
        InvertedUnitA: {
          schemaItemType: "InvertedUnit",
          invertsUnit: "SchemaA.UnitA",
          unitSystem: "SchemaA.UnitSystemB",
        },
      };
      const aJson = getItemJsonWithUnits(aItems);
      const bJson = getItemJsonWithUnits(bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("InvertedUnitA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.InvertedUnitDelta, DiagnosticType.SchemaItem, itemA, ["unitSystem", "SchemaA.UnitSystemA", "SchemaA.UnitSystemB"], itemA.schema);
    });
  });

  describe("Phenomenon delta tests", () => {
    it("No Schema B Phenomenon, all diagnostics reported", async () => {
      const aItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, {});
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("PhenomenonA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "definition" ? true : false)).to.not.be.undefined;
    });

    it("Different definition, diagnostic reported", async () => {
      const aItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const bItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "B",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("PhenomenonA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.PhenomenonDelta, DiagnosticType.SchemaItem, itemA, ["definition", "A", "B"], itemA.schema);
    });
  });

  describe("Constant delta tests", () => {
    it("No Schema B Constant, all diagnostics reported", async () => {
      const aItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const bItems = {
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);
      const itemA = await schemaA.getItem("ConstantA") as ECClass;

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.code === SchemaCompareCodes.SchemaItemMissing ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "phenomenon" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "definition" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "numerator" ? true : false)).to.not.be.undefined;
      expect(reporter.diagnostics.find((d) => d.ecDefinition === itemA && d.messageArgs && d.messageArgs[0] === "denominator" ? true : false)).to.not.be.undefined;
    });

    it("Different phenomenon, diagnostic reported", async () => {
      const aItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
        PhenomenonB: {
          schemaItemType: "Phenomenon",
          definition: "B",
        },
      };
      const bItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonB",
          definition: "A",
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
        PhenomenonB: {
          schemaItemType: "Phenomenon",
          definition: "B",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("ConstantA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.ConstantDelta, DiagnosticType.SchemaItem, itemA, ["phenomenon", "SchemaA.PhenomenonA", "SchemaA.PhenomenonB"], itemA.schema);
    });

    it("Different definition, diagnostic reported", async () => {
      const aItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const bItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "B",
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("ConstantA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.ConstantDelta, DiagnosticType.SchemaItem, itemA, ["definition", "A", "B"], itemA.schema);
    });

    it("Different numerator, diagnostic reported", async () => {
      const aItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
          numerator: 1,
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const bItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
          numerator: 2,
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("ConstantA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.ConstantDelta, DiagnosticType.SchemaItem, itemA, ["numerator", 1, 2], itemA.schema);
    });

    it("Different denominator, diagnostic reported", async () => {
      const aItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
          denominator: 1,
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const bItems = {
        ConstantA: {
          schemaItemType: "Constant",
          phenomenon: "SchemaA.PhenomenonA",
          definition: "A",
          denominator: 2,
        },
        PhenomenonA: {
          schemaItemType: "Phenomenon",
          definition: "A",
        },
      };
      const aJson = getSchemaJsonWithItems(schemaAJson, aItems);
      const bJson = getSchemaJsonWithItems(schemaAJson, bItems);
      const schemaA = await Schema.fromJson(aJson, contextA);
      const schemaB = await Schema.fromJson(bJson, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const itemA = await schemaA.getItem("ConstantA") as ECClass;

      expect(reporter.diagnostics.length).to.equal(1, "Expected 1 difference.");
      validateDiagnostic(reporter.diagnostics[0], SchemaCompareCodes.ConstantDelta, DiagnosticType.SchemaItem, itemA, ["denominator", 1, 2], itemA.schema);
    });
  });
});
