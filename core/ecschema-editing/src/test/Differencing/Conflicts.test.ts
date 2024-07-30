
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConflictCode } from "../../Differencing/SchemaConflicts";
import { Schema, SchemaContext, SchemaProps } from "@itwin/ecschema-metadata";
import { getSchemaDifferences, SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Difference Conflict Reporting", () => {

  function findConflictItem({ conflicts }: SchemaDifferenceResult, name: string, path?: string) {
    return conflicts && conflicts.find((entry) => {
      return entry.itemName === name && (entry.path === path || entry.path);
    });
  }

  function findDifferenceEntries({ differences }: SchemaDifferenceResult, itemName: string) {
    return differences.filter((difference) => "itemName" in difference && difference.itemName === itemName);
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        source: "EntityClass",
        target: "KindOfQuantity",
        description: "Target schema already contains a schema item with the name but different type.",
        difference: {
          customAttributes: [
            {
              className: "ConflictSchema.TestCustomAttributeClass",
            },
          ],
          modifier: "Sealed",
          properties: [{
            description: "name of item",
            label: "Name",
            name: "Name",
            priority: 0,
            type: "PrimitiveProperty",
            typeName: "string",
          }],
          schemaItemType: "EntityClass",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "RelationshipClass",
        itemName: "TestItem",
        source: "RelationshipClass",
        target: "Mixin",
        description: "Target schema already contains a schema item with the name but different type.",
        difference: {
          customAttributes: [
            {
              className: "ConflictSchema.TestCustomAttributeClass",
            },
          ],
          description: "Description of TestRelationship",
          modifier: "None",
          schemaItemType: "RelationshipClass",
          source: {
            constraintClasses: [
              "ConflictSchema.TestEntityClass",
            ],
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "refers to",
          },
          strength: "Referencing",
          strengthDirection: "Forward",
          target: {
            constraintClasses: [
              "ConflictSchema.TestEntityClass",
            ],
            customAttributes: [
              {
                className: "ConflictSchema.TestCustomAttributeClass",
              },
            ],
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is referenced by",
          },
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "Enumeration",
        itemName: "TestItem",
        source: "Enumeration",
        target: "CustomAttributeClass",
        description: "Target schema already contains a schema item with the name but different type.",
        difference: {
          enumerators: [
            {
              name: "EnumeratorOne",
              value: 1,
            },
          ],
          isStrict: undefined,
          schemaItemType: "Enumeration",
          type: "int",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "Phenomenon",
        itemName: "TestItem",
        source: "Phenomenon",
        target: "PropertyCategory",
        description: "Target schema already contains a schema item with the name but different type.",
        difference: {
          definition: "TestPhenomenon",
          schemaItemType: "Phenomenon",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "Format",
        itemName: "TestItem",
        source: "Format",
        target: "StructClass",
        description: "Target schema already contains a schema item with the name but different type.",
        difference: {
          composite: {
            spacer: "",
            units: [
              {
                label: "'",
                name: "ConflictSchema.TestUnit",
              },
            ],
          },
          decimalSeparator: ",",
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          precision: 8,
          schemaItemType: "Format",
          thousandSeparator: ".",
          type: "Fractional",
          uomSeparator: "",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingItemName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        source: "EntityClass",
        target: "StructClass",        
        description: "Target schema already contains a schema item with the name but different type.",
        difference: sourceSchema.items.TestItem,
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        path: "TestProperty",
        source: "string",
        target: "double",
        description: "Target class already contains a property with a different type.",
        difference: {
          name: "TestProperty",
          type: "PrimitiveProperty",
          typeName: "string",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        path: "TestProperty",
        source: "PrimitiveArrayProperty",
        target: "PrimitiveProperty",
        description: "Target class already contains a property with a different type.",
        difference: {
          maxOccurs: 2147483647,
          minOccurs: 0,
          name: "TestProperty",
          type: "PrimitiveArrayProperty",
          typeName: "int",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        path: "TestProperty",
        source: "ConflictSchema.TestEnum",
        target: undefined,
        description: "Target class already contains a property with a different type.",
        difference: {
          name: "TestProperty",
          type: "PrimitiveProperty",
          typeName: "ConflictSchema.TestEnum",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        path: "TestProperty",
        source: "PrimitiveProperty",
        target: "StructArrayProperty",
        description: "Target class already contains a property with a different type.",
        difference: {
          name: "TestProperty",
          type: "PrimitiveProperty",
          typeName: "ConflictSchema.TestEnum",
        },
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
      expect(findDifferenceEntries(differences, "TestItem")).has.lengthOf(0);
      expect(findConflictItem(differences, "TestItem")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "TestItem",
        path: "TestProperty",
        source: "NavigationProperty",
        target: "StructProperty",
        description: "Target class already contains a property with a different type.",
        difference: {
          direction: "Backward",
          name: "TestProperty",
          relationshipName: "ConflictSchema.TestRelationship",
          type: "NavigationProperty",
        },
      });
    });
  });

  describe("Base Class conflicts", () => {
    const sourceSchema = {
      ...schemaHeader,
      items: {
        EmptyAbstractEntity: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
        ConflictingBaseClassEntity: {
          schemaItemType: "EntityClass",
          baseClass: "ConflictSchema.InvalidBaseClassEntity",
        },
        InvalidBaseClassEntity: {
          schemaItemType: "EntityClass",
        },
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
        EmptyAbstractEntity: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
        ConflictingBaseClassEntity: {
          schemaItemType: "EntityClass",
          baseClass: "ConflictSchema.EmptyAbstractEntity",
        },
        InvalidBaseClassEntity: {
          schemaItemType: "EntityClass",
          baseClass: "ConflictSchema.EmptyAbstractEntity",
        },
        InvalidBaseClassEntityWithSealedBaseClass: {
          schemaItemType: "EntityClass",
        },
      },
    };

    it("should find a conflict for changing base classes", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "ConflictingBaseClassEntity")).deep.equals({
        code: ConflictCode.ConflictingBaseClass,
        schemaType: "EntityClass",
        itemName: "ConflictingBaseClassEntity",
        path: "$baseClass",
        source: "ConflictSchema.InvalidBaseClassEntity",
        target: "ConflictSchema.EmptyAbstractEntity",
        description: "BaseClass is not valid, source class must derive from target.",
      });
    });

    it("should find a conflict for invalid base class value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "InvalidBaseClassEntity")).deep.equals({
        code: ConflictCode.RemovingBaseClass,
        schemaType: "EntityClass",
        itemName: "InvalidBaseClassEntity",
        path: "$baseClass",
        source: undefined,
        target: "ConflictSchema.EmptyAbstractEntity",
        description: "BaseClass cannot be set unset if there has been a baseClass before.",
      });
    });

    it("should find a conflict if change tries to assign a sealed baseclass value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "InvalidBaseClassEntityWithSealedBaseClass")).deep.equals({
        code: ConflictCode.SealedBaseClass,
        schemaType: "EntityClass",
        itemName: "InvalidBaseClassEntityWithSealedBaseClass",
        path: "$baseClass",
        source: "ConflictSchema.SealedBaseClassEntity",
        target: undefined,
        description: "BaseClass is sealed.",
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
      expect(findConflictItem(differences, "ConflictingMixinEntity")).deep.equals({
        code: ConflictCode.MixinAppliedMustDeriveFromConstraint,
        schemaType: "EntityClass",
        itemName: "ConflictingMixinEntity",
        path: "$mixins",
        source: "ConflictSchema.ConflictingMixin",
        target: undefined,
        description: "Mixin cannot applied to this class.",
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
      expect(findConflictItem(differences, "ConflictEnumerators")).deep.equals({
        code: ConflictCode.ConflictingEnumeratorValue,
        schemaType: "Enumeration",
        itemName: "ConflictEnumerators",
        path: "EnumeratorOne",
        source: 1000,
        target: 1,
        description: "Enumerator values must not differ.",
      });
    });

    it("should find a conflict for enumerations with different primitive types", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "ConflictEnumerationType")).deep.equals({
        code: ConflictCode.ConflictingEnumerationType,
        schemaType: "Enumeration",
        itemName: "ConflictEnumerationType",
        source: "string",
        target: "int",
        description: "Enumeration has a different primitive type.",
      });
    });
  });
});
