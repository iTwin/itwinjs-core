/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SchemaContext } from "../../Context";
import { Schema } from "../../Metadata/Schema";
import { ECObjectsError } from "../../Exception";

describe("Schema from json creation with different containers tests", () => {
  let context: SchemaContext;
  const dummyRefJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReference",
    version: "01.00.01",
    alias: "dumRef",
  };

  const schemaAJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaA",
    version: "1.2.3",
    alias: "a",
    label: "labelA",
    description: "descriptionA",
  };

  beforeEach(async () => {
    context = new SchemaContext();
  });

  describe("Schema from json creation with class containers tests", () => {
    it("should create a schema with custom attributes and reference as normal", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefJson,
        items: {
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, context);

      const schemaA = {
        ...schemaAJson,
        references: [
          {
            name: "DummyReference",
            version: "01.00.01",
          },
        ],
        customAttributes: [
          {
            className: "DummyReference.customAttributeOne",
            showClasses: true,
          },
        ],
      };

      expect(await Schema.fromJson(schemaA, context)).to.not.be.undefined;
    });

    it("should throw an error and not allow the creation of the schema with item custom attribute and no reference defined", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefJson,
        items: {
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, context);

      const schemaA = {
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
            customAttributes: [
              {
                className: "DummyReference.customAttributeOne",
                showClasses: true,
              },
            ],
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      };

      await expect(Schema.fromJson(schemaA, context)).to.be.rejectedWith(ECObjectsError, "Unable to load custom attribute DummyReference.customAttributeOne from container SchemaA.testClassOne, DummyReference reference not defined");
    });

    it("should throw an error not allow the creation of a schema with relationship class and custom attribute and no reference defined", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefJson,
        items: {
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
          customAttributeTwo: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, context);

      const schemaA = {
        ...schemaAJson,
        items: {
          relationshipOne: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            customAttributes: [
              {
                className: "DummyReference.customAttributeOne",
                showClasses: true,
              },
            ],
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
              ],
            },
          },
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      };

      await expect(Schema.fromJson(schemaA, context)).to.be.rejectedWith(ECObjectsError, "Unable to load custom attribute DummyReference.customAttributeOne from container SchemaA.relationshipOne, DummyReference reference not defined");
    });
  });

  describe("Schema from json creation with property containers that have custom attributes tests", () => {
    it("should throw an error and not allow the creation of the schema with custom attribute in a property container and no reference defined", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefJson,
        items: {
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, context);

      const schemaA = {
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
            properties: [
              {
                name: "Offset",
                type: "PrimitiveProperty",
                isReadOnly: true,
                priority: 0,
                typeName: "double",
                customAttributes: [
                  {
                    className: "DummyReference.customAttributeOne",
                    showClasses: true,
                  },
                ],
              },
            ],
          },
        },
      };

      await expect(Schema.fromJson(schemaA, context)).to.be.rejectedWith(ECObjectsError, "Unable to load custom attribute DummyReference.customAttributeOne from container testClassOne.Offset, DummyReference reference not defined");
    });
  });
});
