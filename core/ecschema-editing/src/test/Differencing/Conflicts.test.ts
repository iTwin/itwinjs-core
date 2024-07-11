
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
              "className": "ConflictSchema.TestCustomAttributeClass"
            }
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
          schemaItemType: "EntityClass"
        }
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
              className: "ConflictSchema.TestCustomAttributeClass"
            }
          ],
          description: "Description of TestRelationship",
          modifier: "None",
          schemaItemType: "RelationshipClass",
          source: {
            constraintClasses: [
              "ConflictSchema.TestEntityClass"
            ],
            customAttributes: [
              {
                "className": "ConflictSchema.TestCustomAttributeClass"
              }
            ],
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "refers to",
          },
          strength: "Referencing",
          strengthDirection: "Forward",
          target: {
            constraintClasses: [
              "ConflictSchema.TestEntityClass"
            ],
            customAttributes: [
              {
                "className": "ConflictSchema.TestCustomAttributeClass"
              }
            ],
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is referenced by",
          }
        }
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
            }
          ],
          isStrict: undefined,
          schemaItemType: "Enumeration",
          type: "int",
        }
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
        }
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
              }
            ]
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
        }
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

  describe("Property conflicts", () => {
    const sourceSchema = {
      ...schemaHeader,
      items: {
        ConflictingPropertyEntity: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "MyProperty",
              type: "PrimitiveProperty",
              typeName: "boolean",
            },
          ],
        },
      },
    };

    const targetSchema = {
      ...schemaHeader,
      items: {
        ConflictingPropertyEntity: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "MyProperty",
              type: "PrimitiveProperty",
              typeName: "string",
            },
          ],
        },
      },
    };

    it("should find a conflict for properties with different type", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "ConflictingPropertyEntity")).deep.equals({
        code: ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName: "ConflictingPropertyEntity",
        path: "MyProperty",
        source: "boolean",
        target: "string",
        description: "Target class already contains a property with a different type.",
        difference: {
          name: "MyProperty",
          type: "PrimitiveProperty",
          typeName: "boolean",
        }
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
