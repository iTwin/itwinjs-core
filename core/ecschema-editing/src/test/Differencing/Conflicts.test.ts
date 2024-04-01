
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ConflictCode } from "../../Differencing/SchemaConflicts";
import { Schema, SchemaContext, SchemaProps } from "@itwin/ecschema-metadata";
import { SchemaDifference, SchemaDifferences } from "../../Differencing/SchemaDifference";
import { expect } from "chai";
/* eslint-disable @typescript-eslint/naming-convention */

describe("Difference Conflict Reporting", () => {

  function findConflictItem(differences: SchemaDifferences, name: string, path?: string) {
    return differences.conflicts.find((entry) => entry.itemName === name && (entry.path === path || entry.path));
  }

  async function runDifferences(sourceSchemaJson: SchemaProps, targetSchemaJson: SchemaProps) {
    const sourceContext = new SchemaContext();
    const sourceSchema = await Schema.fromJson(sourceSchemaJson, sourceContext);

    const targetContext = new SchemaContext();
    const targetSchema = await Schema.fromJson(targetSchemaJson, targetContext);

    return SchemaDifference.fromSchemas(targetSchema, sourceSchema);
  }

  const schemaHeader = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ConflictSchema",
    version: "1.0.0",
    alias: "conflict",
  };

  describe("Schema conflicts", () => {
    const sourceSchema = {
      ...schemaHeader,
      items: {
        SameNameOtherItemType: {
          schemaItemType: "PropertyCategory",
        },
      },
    };

    const targetSchema = {
      ...schemaHeader,
      items: {
        SameNameOtherItemType: {
          schemaItemType: "EntityClass",
        },
      },
    };

    it("should find a conflict for schema items with different type", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "SameNameOtherItemType")).deep.equals({
        code:    ConflictCode.ConflictingItemName,
        schemaType: "PropertyCategory",
        itemName:    "SameNameOtherItemType",
        source:  "PropertyCategory",
        target:  "EntityClass",
        description: "Target schema already contains a schema item with the name but different type.",
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
        code:    ConflictCode.ConflictingBaseClass,
        schemaType: "EntityClass",
        itemName:    "ConflictingBaseClassEntity",
        path:    "$baseClass",
        source:  "ConflictSchema.InvalidBaseClassEntity",
        target:  "ConflictSchema.EmptyAbstractEntity",
        description: "BaseClass is not valid, source class must derive from target.",
      });
    });

    it("should find a conflict for invalid base class value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "InvalidBaseClassEntity")).deep.equals({
        code:    ConflictCode.RemovingBaseClass,
        schemaType: "EntityClass",
        itemName:    "InvalidBaseClassEntity",
        path:    "$baseClass",
        source:  undefined,
        target:  "ConflictSchema.EmptyAbstractEntity",
        description: "BaseClass cannot be set unset if there has been a baseClass before.",
      });
    });

    it("should find a conflict if change tries to assign a sealed baseclass value", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "InvalidBaseClassEntityWithSealedBaseClass")).deep.equals({
        code:    ConflictCode.SealedBaseClass,
        schemaType: "EntityClass",
        itemName:    "InvalidBaseClassEntityWithSealedBaseClass",
        path:    "$baseClass",
        source:  "ConflictSchema.SealedBaseClassEntity",
        target:  undefined,
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
        code:    ConflictCode.MixinAppliedMustDeriveFromConstraint,
        schemaType: "EntityClass",
        itemName:    "ConflictingMixinEntity",
        path:    "$mixins",
        source:  "ConflictSchema.ConflictingMixin",
        target:  undefined,
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
        code:    ConflictCode.ConflictingPropertyName,
        schemaType: "EntityClass",
        itemName:    "ConflictingPropertyEntity",
        path:    "MyProperty",
        source:  "boolean",
        target:  "string",
        description: "Target class already contains a property with a different type.",
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
      expect(findConflictItem(differences,"ConflictEnumerators")).deep.equals({
        code:    ConflictCode.ConflictingEnumeratorValue,
        schemaType: "Enumeration",
        itemName:    "ConflictEnumerators",
        path:    "EnumeratorOne",
        source:  1000,
        target:  1,
        description: "Enumerator values must not differ.",
      });
    });

    it("should find a conflict for enumerations with different primitive types", async () => {
      const differences = await runDifferences(sourceSchema, targetSchema);
      expect(findConflictItem(differences, "ConflictEnumerationType")).deep.equals({
        code:    ConflictCode.ConflictingEnumerationType,
        schemaType: "Enumeration",
        itemName:    "ConflictEnumerationType",
        source:  "string",
        target:  "int",
        description: "Enumeration has a different primitive type.",
      });
    });
  });
});
