/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConflictCode, SchemaDifferenceConflict } from "../../Differencing/SchemaConflicts";
import { Schema, SchemaContext, SchemaProps } from "@itwin/ecschema-metadata";
import { getSchemaDifferences, SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema Difference Conflicts", () => {

  async function findConflictItem({ conflicts }: SchemaDifferenceResult, name: string, path?: string) {
    return conflicts && conflicts.find((entry) => {
      return entry.itemName === name && (entry.path === path || entry.path);
    });
  }

  async function runDifferences(sourceSchemaJson: SchemaProps, targetSchemaJson: SchemaProps) {
    const sourceContext = new SchemaContext();
    const sourceSchema = await Schema.fromJson(sourceSchemaJson, sourceContext);

    const targetContext = new SchemaContext();
    const targetSchema = await Schema.fromJson(targetSchemaJson, targetContext);

    return getSchemaDifferences(targetSchema, sourceSchema);
  }

  const schemaHeader = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ConflictSchema",
    version: "1.0.0",
    alias: "conflict",
  };

  describe("Different schema conflicts", () => {
    it("should find a conflict if added schema reference has a already used alias.", async () => {
      const sourceContext = new SchemaContext();
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ReferenceB",
        version: "1.0.0",
        alias: "ref",
      }, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...schemaHeader,
        references: [
          {
            name: "ReferenceB",
            version: "1.0.0",
          },
        ],
      }, sourceContext);

      const targetContext = new SchemaContext();
      await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ReferenceA",
        version: "1.0.0",
        alias: "ref",
      }, targetContext);

      const targetSchema = await Schema.fromJson({
        ...schemaHeader,
        references: [
          {
            name: "ReferenceA",
            version: "1.0.0",
          },
        ],
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).to.have.a.lengthOf(1).and.satisfies(([conflict]: SchemaDifferenceConflict[]) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingReferenceAlias);
        expect(conflict).to.have.a.property("schemaType", "SchemaReference");
        expect(conflict).to.have.a.property("source", "ReferenceB");
        expect(conflict).to.have.a.property("target", "ReferenceA");
        expect(conflict).to.have.a.property("description", "Target schema already references a different schema with this alias.");
        return true;
      });
    });
  });

  describe("Different schema item type conflicts", () => {
    it("should find a conflict between EntityClass and KindOfQuantity types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            properties: [
              {
                name: "Name",
                type: "PrimitiveProperty",
                description: "name of item",
                label: "Name",
                priority: 0,
                typeName: "string",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestUnitSystem: {
            schemaItemType: "UnitSystem",
          },
          TestPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "TestPhenomenon",
          },
          TestUnit: {
            schemaItemType: "Unit",
            unitSystem: "ConflictSchema.TestUnitSystem",
            phenomenon: "ConflictSchema.TestPhenomenon",
            definition: "TestUnit",
          },
          TestItem: {
            schemaItemType: "KindOfQuantity",
            description: "Description of koq",
            persistenceUnit: "ConflictSchema.TestUnit",
            relativeError: 1.23,
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "KindOfQuantity");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "KindOfQuantity");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });

    it("should find a conflict between RelationshipClass and Mixin types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestEntityClass: {
            schemaItemType: "EntityClass",
          },
          TestItem: {
            schemaItemType: "RelationshipClass",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            description: "Description of TestRelationship",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              abstractContraint: "ConflictSchema.TestEntityClass",
              constraintClasses: [
                "ConflictSchema.TestEntityClass",
              ],
              customAttributes: [
                {
                  className: "ConflictSchema.TestCustomAttributeClass",
                },
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              abstractContraint: "ConflictSchema.TestEntityClass",
              constraintClasses: [
                "ConflictSchema.TestEntityClass",
              ],
              customAttributes: [
                {
                  className: "ConflictSchema.TestCustomAttributeClass",
                },
              ],
            },
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestEntityClass: {
            schemaItemType: "EntityClass",
          },
          TestItem: {
            schemaItemType: "Mixin",
            appliesTo: "ConflictSchema.TestEntityClass",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            properties: [
              {
                name: "Name",
                type: "PrimitiveProperty",
                description: "name of item",
                label: "Name",
                priority: 0,
                typeName: "string",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "Mixin");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "RelationshipClass");
        expect(conflict).to.have.a.property("target", "Mixin");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });

    it("should find a conflict between CustomAttributeClass and Enumeration types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "EnumeratorOne",
                value: 1,
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            properties: [
              {
                name: "Name",
                type: "PrimitiveProperty",
                description: "name of item",
                label: "Name",
                priority: 0,
                typeName: "string",
                customAttributes: [
                  {
                    className: "ConflictSchema.TestCustomAttributeClass",
                  },
                ],
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "CustomAttributeClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "Enumeration");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });

    it("should find a conflict between PropertyCategory and Phenomenon types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "Phenomenon",
            definition: "TestPhenomenon",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "PropertyCategory",
            priority: 4,
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "PropertyCategory");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "Phenomenon");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });

    it("should find a conflict between StructClass and Format types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestUnitSystem: {
            schemaItemType: "UnitSystem",
          },
          TestPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "TestPhenomenon",
          },
          TestUnit: {
            schemaItemType: "Unit",
            unitSystem: "ConflictSchema.TestUnitSystem",
            phenomenon: "ConflictSchema.TestPhenomenon",
            definition: "TestUnit",
          },
          TestItem: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 8,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint",
              "ShowUnitLabel",
            ],
            decimalSeparator: ",",
            thousandSeparator: ".",
            uomSeparator: "",
            composite: {
              spacer: "",
              units: [
                {
                  name: "ConflictSchema.TestUnit",
                  label: "'",
                },
              ],
            },
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestItem: {
            schemaItemType: "StructClass",
            modifier: "Sealed",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            properties: [
              {
                name: "Name",
                type: "PrimitiveProperty",
                description: "name of item",
                label: "Name",
                priority: 0,
                typeName: "string",
                customAttributes: [
                  {
                    className: "ConflictSchema.TestCustomAttributeClass",
                  },
                ],
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "StructClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "Format");
        expect(conflict).to.have.a.property("target", "StructClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });

    it("should find a conflict between EntityClass and StructClass types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
          TestCustomAttributeClass: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            label: "TestItem",
            modifier: "Sealed",
            baseClass: "ConflictSchema.TestEntity",
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            properties: [
              {
                name: "Name",
                type: "PrimitiveProperty",
                description: "name of item",
                label: "Name",
                priority: 0,
                typeName: "string",
              },
              {
                name: "Type",
                type: "PrimitiveProperty",
                description: "type of item",
                label: "Type",
                priority: 0,
                typeName: "int",
                customAttributes: [
                  {
                    className: "ConflictSchema.TestCustomAttributeClass",
                  },
                ],
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "Type",
                type: "PrimitiveProperty",
                description: "type of item",
                label: "Type",
                priority: 0,
                typeName: "int",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("schemaType", "StructClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
      });
    });
  });

  describe("Different property type conflicts", () => {
    it("should find a conflict between primitive properties with different primitive types", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "string");
        expect(conflict).to.have.a.property("target", "double");
        expect(conflict).to.have.a.property("description", "Target class already contains a property with a different type.");
      });
    });

    it("should find a conflict between primitive and primitive array properties", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "[int]");
        expect(conflict).to.have.a.property("target", "string");
        expect(conflict).to.have.a.property("description", "Target class already contains a property with a different type.");
      });
    });

    it("should find a conflict between primitive and enumeration properties", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEnum: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                label: "first value",
                name: "FirstValue",
                value: 0,
              },
            ],
          },
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "ConflictSchema.TestEnum",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "ConflictSchema.TestEnum");
        expect(conflict).to.have.a.property("target", "int");
        expect(conflict).to.have.a.property("description", "Target class already contains a property with a different type.");
      });
    });

    it("should find a conflict between struct and enumeration array properties", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEnum: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                label: "first value",
                name: "FirstValue",
                value: 0,
              },
            ],
          },
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "ConflictSchema.TestEnum",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "StructArrayProperty",
                typeName: "ConflictSchema.TestStruct",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "ConflictSchema.TestEnum");
        expect(conflict).to.have.a.property("target", "[ConflictSchema.TestStruct]");
        expect(conflict).to.have.a.property("description", "Target class already contains a property with a different type.");
      });
    });

    it("should find a conflict between struct and navigation properties", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "ConflictSchema.TestEntity",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "ConflictSchema.TestEntity",
              ],
            },
          },
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "NavigationProperty",
                relationshipName: "ConflictSchema.TestRelationship",
                direction: "backward",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "StructProperty",
                typeName: "ConflictSchema.TestStruct",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "ConflictSchema.TestRelationship");
        expect(conflict).to.have.a.property("target", "ConflictSchema.TestStruct");
        expect(conflict).to.have.a.property("description", "Target class already contains a property with a different type.");
      });
    });
  });

  describe("Different Kind of quantity on property conflicts", () => {
    const unitItems = {
      M: {
        schemaItemType: "Unit",
        phenomenon: "ConflictSchema.Length",
        unitSystem: "ConflictSchema.Metric",
        definition: "M",
      },
      SQ_M: {
        schemaItemType: "Unit",
        label: "m²",
        phenomenon: "ConflictSchema.AREA",
        unitSystem: "ConflictSchema.Metric",
        definition: "M(2)",
      },
      Length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
        label: "length",
      },
      AREA: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(2)",
        label: "area",
      },
      Metric: {
        schemaItemType: "UnitSystem",
        label: "metric",
      },
      KoQ_1: {
        schemaItemType: "KindOfQuantity",
        relativeError: 2,
        persistenceUnit: "ConflictSchema.M",
      },
      KoQ_2: {
        schemaItemType: "KindOfQuantity",
        relativeError: 2,
        persistenceUnit: "ConflictSchema.SQ_M",
      },
      KoQ_3: {
        schemaItemType: "KindOfQuantity",
        relativeError: 2,
        persistenceUnit: "ConflictSchema.SQ_M",
      },
    };

    it("should find a conflict if properties kind of quantities is not set on target", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_1",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantity);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "ConflictSchema.KoQ_1");
        expect(conflict).to.have.a.property("target", null);
        expect(conflict).to.have.a.property("description", "The kind of quantity cannot be assiged if the property did not have a kind of quantities before.");
      });
    });

    it("should find a conflict when properties kind of quantities persistence unit differs", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_2",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_1",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantityUnit);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", "ConflictSchema.KoQ_2");
        expect(conflict).to.have.a.property("target", "ConflictSchema.KoQ_1");
        expect(conflict).to.have.a.property("description", "The property has different kind of quantities with conflicting units.");
      });
    });

    it("should find a conflict when properties kind of quantities persistence is undefind in source", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_1",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantity);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestItem");
        expect(conflict).to.have.a.property("path", "TestProperty");
        expect(conflict).to.have.a.property("source", null);
        expect(conflict).to.have.a.property("target", "ConflictSchema.KoQ_1");
        expect(conflict).to.have.a.property("description", "The kind of quantity cannot be undefined if the property had a kind of quantities before.");
      });
    });

    it("should not find a conflict if kind of quantities differed but persistence unit is same", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_3",
              },
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          ...unitItems,
          TestItem: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "ConflictSchema.KoQ_2",
              },
            ],
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestItem")).to.be.eventually.undefined;
    });
  });

  describe("Class modifier conflicts", () => {
    it("should find a conflict if class has changed modifier from Abstract to Sealed", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingClassModifier);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestEntity");
        expect(conflict).to.have.a.property("source", "Sealed");
        expect(conflict).to.have.a.property("target", "Abstract");
        expect(conflict).to.have.a.property("description", "Class has conflicting modifiers.");
      });
    });

    it("should find a conflict if class has changed modifier from None to Abstract", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "None",
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingClassModifier);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "TestEntity");
        expect(conflict).to.have.a.property("source", "Abstract");
        expect(conflict).to.have.a.property("target", "None");
        expect(conflict).to.have.a.property("description", "Class has conflicting modifiers.");
      });
    });

    it("should not find a conflict if class has changed modifier from Sealed to None", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "None",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "TestEntity")).to.be.eventually.undefined;
    });
  });

  describe("Base Class conflicts", () => {
    it("should find a conflict if the new base class does not derive from current target baseclass", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          InvalidBaseClassEntity: {
            schemaItemType: "EntityClass",
          },
          ConflictingBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.InvalidBaseClassEntity",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ConflictingBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.EmptyAbstractEntity",
          },
        },
      };
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ConflictingBaseClassEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingBaseClass);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "ConflictingBaseClassEntity");
        expect(conflict).to.have.a.property("path", "$baseClass");
        expect(conflict).to.have.a.property("source", "ConflictSchema.InvalidBaseClassEntity");
        expect(conflict).to.have.a.property("target", "ConflictSchema.EmptyAbstractEntity");
        expect(conflict).to.have.a.property("description", "BaseClass is not valid, source class must derive from target.");
      });
    });

    it("should find a conflict if the new base class does not derive from current target baseclass from a different schema with the same name", async () => {
      const sourceSchemaJson = {
        ...schemaHeader,
        references: [
          {
            name: "ReferencedSchema",
            version: "1.0.0",
          },
        ],
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          InvalidBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.EmptyAbstractEntity",
          },
          ConflictingBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ReferencedSchema.InvalidBaseClassEntity",
          },
        },
      };

      const targetSchemaJson = {
        ...schemaHeader,
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ConflictingBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.EmptyAbstractEntity",
          },
        },
      };

      const referencedSchemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ReferencedSchema",
        version: "1.0.0",
        alias: "ref",
        items: {
          InvalidBaseClassEntity: {
            schemaItemType: "EntityClass",
          },
        },
      };

      const sourceContext = new SchemaContext();
      await Schema.fromJson(referencedSchemaJson, sourceContext);
      const sourceSchema = await Schema.fromJson(sourceSchemaJson, sourceContext);

      const targetContext = new SchemaContext();
      const targetSchema = await Schema.fromJson(targetSchemaJson, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      await expect(findConflictItem(differences, "ConflictingBaseClassEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingBaseClass);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "ConflictingBaseClassEntity");
        expect(conflict).to.have.a.property("path", "$baseClass");
        expect(conflict).to.have.a.property("source", "ReferencedSchema.InvalidBaseClassEntity");
        expect(conflict).to.have.a.property("target", "ConflictSchema.EmptyAbstractEntity");
        expect(conflict).to.have.a.property("description", "BaseClass is not valid, source class must derive from target.");
      });
    });

    it("should not find a conflict if the new base class derives from current target baseclass (narrowing)", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ActualBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.ConcreteEntity",
          },
          ConcreteEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.BaseEntity",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ActualBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.BaseEntity",
          },
        },
      };
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ActualBaseClassEntity")).to.be.eventually.undefined;
    });

    it("should not find a conflict if the new base class derives from target baseclass but schemaname differs", async () => {
      const sourceSchema = {
        ...schemaHeader,
        name: "ConflictSchema2",
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ActualBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema2.ConcreteEntity",
          },
          ConcreteEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema2.BaseEntity",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          BaseEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ActualBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.BaseEntity",
          },
        },
      };
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ActualBaseClassEntity")).to.be.eventually.undefined;
    });

    it("should  not find a conflict if the new base class derives from target baseclass from referenced schemas", async () => {
      const sourceSchemaJson = {
        ...schemaHeader,
        references: [
          {
            name: "ReferencedSchema",
            version: "1.0.0",
          },
        ],
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
            baseClass: "ReferencedSchema.ActualBaseClassEntity",
          },
          TestBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ReferencedSchema.ActualBaseClassEntity",
          },
        },
      };

      const targetSchemaJson = {
        ...schemaHeader,
        references: [
          {
            name: "ReferencedSchema",
            version: "1.0.0",
          },
        ],
        items: {
          TestBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ReferencedSchema.ActualBaseClassEntity",
          },
        },
      };

      const referencedSchemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ReferencedSchema",
        version: "1.0.0",
        alias: "ref",
        items: {
          ActualBaseClassEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
        },
      };

      const sourceContext = new SchemaContext();
      await Schema.fromJson(referencedSchemaJson, sourceContext);
      const sourceSchema = await Schema.fromJson(sourceSchemaJson, sourceContext);

      const targetContext = new SchemaContext();
      await Schema.fromJson(referencedSchemaJson, targetContext);
      const targetSchema = await Schema.fromJson(targetSchemaJson, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      await expect(findConflictItem(differences, "TestBaseClassEntity")).to.be.eventually.undefined;
    });

    it("should find a conflict if a base class is removed", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          InvalidBaseClassEntity: {
            schemaItemType: "EntityClass",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          InvalidBaseClassEntity: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.EmptyAbstractEntity",
          },
        },
      };
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "InvalidBaseClassEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.RemovingBaseClass);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "InvalidBaseClassEntity");
        expect(conflict).to.have.a.property("path", "$baseClass");
        expect(conflict).to.have.a.property("source", null);
        expect(conflict).to.have.a.property("target", "ConflictSchema.EmptyAbstractEntity");
        expect(conflict).to.have.a.property("description", "BaseClass cannot be removed, if there has been a baseClass before.");
      });
    });

    it("should find a conflict if change tries to assign a sealed baseclass value", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          InvalidBaseClassEntityWithSealedBaseClass: {
            schemaItemType: "EntityClass",
            baseClass: "ConflictSchema.SealedBaseClassEntity",
          },
          SealedBaseClassEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          InvalidBaseClassEntityWithSealedBaseClass: {
            schemaItemType: "EntityClass",
          },
        },
      };
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "InvalidBaseClassEntityWithSealedBaseClass")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.SealedBaseClass);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "InvalidBaseClassEntityWithSealedBaseClass");
        expect(conflict).to.have.a.property("path", "$baseClass");
        expect(conflict).to.have.a.property("source", "ConflictSchema.SealedBaseClassEntity");
        expect(conflict).to.have.a.property("target", null);
        expect(conflict).to.have.a.property("description", "BaseClass is sealed.");
      });
    });
  });

  describe("Mixin conflicts", () => {
    it("should find a conflict if the mixins does not derive from constraint", async () => {
      const sourceSchema = {
        ...schemaHeader,
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ConflictingMixin: {
            schemaItemType: "Mixin",
            label: "Missing Mixin",
            appliesTo: "ConflictSchema.EmptyAbstractEntity",
          },
          ConflictingMixinEntity: {
            schemaItemType: "EntityClass",
            mixins: [
              "ConflictSchema.ConflictingMixin",
            ],
          },
        },
      };

      const targetSchema = {
        ...schemaHeader,
        items: {
          EmptyAbstractEntity: {
            schemaItemType: "EntityClass",
            modifier: "Abstract",
          },
          ConflictingMixin: {
            schemaItemType: "Mixin",
            label: "Missing Mixin",
            appliesTo: "ConflictSchema.EmptyAbstractEntity",
          },
          ConflictingMixinEntity: {
            schemaItemType: "EntityClass",
          },
        },
      };

      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ConflictingMixinEntity")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.MixinAppliedMustDeriveFromConstraint);
        expect(conflict).to.have.a.property("schemaType", "EntityClass");
        expect(conflict).to.have.a.property("itemName", "ConflictingMixinEntity");
        expect(conflict).to.have.a.property("path", "$mixins");
        expect(conflict).to.have.a.property("source", "ConflictSchema.ConflictingMixin");
        expect(conflict).to.have.a.property("target", undefined);
        expect(conflict).to.have.a.property("description", "Mixin cannot applied to this class.");
      });
    });
  });

  describe("Enumeration conflicts", () => {
    const sourceSchema = {
      ...schemaHeader,
      items: {
        ConflictEnumerators: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "EnumeratorOne",
              value: 1000,
            },
          ],
        },
        ConflictEnumerationType: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "EnumeratorOne",
              value: "one",
            },
          ],
        },
      },
    };

    const targetSchema = {
      ...schemaHeader,
      items: {
        ConflictEnumerators: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "EnumeratorOne",
              value: 1,
            },
          ],
        },
        ConflictEnumerationType: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "EnumeratorOne",
              value: 1,
            },
          ],
        },
      },
    };

    it("should find a conflict for conflicting enumerator value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ConflictEnumerators")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingEnumeratorValue);
        expect(conflict).to.have.a.property("schemaType", "Enumeration");
        expect(conflict).to.have.a.property("itemName", "ConflictEnumerators");
        expect(conflict).to.have.a.property("path", "EnumeratorOne");
        expect(conflict).to.have.a.property("source", 1000);
        expect(conflict).to.have.a.property("target", 1);
        expect(conflict).to.have.a.property("description", "Enumerators must have unique values.");
      });
    });

    it("should find a conflict for enumerations with different primitive types", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ConflictEnumerationType")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingEnumerationType);
        expect(conflict).to.have.a.property("schemaType", "Enumeration");
        expect(conflict).to.have.a.property("itemName", "ConflictEnumerationType");
        expect(conflict).to.have.a.property("source", "string");
        expect(conflict).to.have.a.property("target", "int");
        expect(conflict).to.have.a.property("description", "Enumeration has a different primitive type.");
      });
    });
  });

  describe("KindOfQuantity conflicts", () => {
    const unitItems = {
      M: {
        schemaItemType: "Unit",
        phenomenon: "ConflictSchema.Length",
        unitSystem: "ConflictSchema.Metric",
        definition: "M",
      },
      SQ_M: {
        schemaItemType: "Unit",
        label: "m²",
        phenomenon: "ConflictSchema.AREA",
        unitSystem: "ConflictSchema.Metric",
        definition: "M(2)",
      },
      Length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
        label: "length",
      },
      AREA: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(2)",
        label: "area",
      },
      Metric: {
        schemaItemType: "UnitSystem",
        label: "metric",
      },
    };

    const sourceSchema = {
      ...schemaHeader,
      items: {
        ...unitItems,
        ConflictKoQ: {
          schemaItemType: "KindOfQuantity",
          name: "ConflictKoQ",
          relativeError: 2,
          persistenceUnit: "ConflictSchema.SQ_M",
        },
      },
    };

    const targetSchema = {
      ...schemaHeader,
      items: {
        ...unitItems,
        ConflictKoQ: {
          schemaItemType: "KindOfQuantity",
          name: "ConflictKoQ",
          relativeError: 2,
          persistenceUnit: "ConflictSchema.M",
        },
      },
    };

    it("should find a conflict for conflicting KindOfQuantity persistence unit value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      await expect(findConflictItem(differences, "ConflictKoQ")).to.be.eventually.not.undefined.then((conflict) => {
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPersistenceUnit);
        expect(conflict).to.have.a.property("schemaType", "KindOfQuantity");
        expect(conflict).to.have.a.property("itemName", "ConflictKoQ");
        expect(conflict).to.have.a.property("source", "ConflictSchema.SQ_M");
        expect(conflict).to.have.a.property("target", "ConflictSchema.M");
        expect(conflict).to.have.a.property("description", "Kind of Quantity has a different persistence unit.");
      });
    });
  });
});
