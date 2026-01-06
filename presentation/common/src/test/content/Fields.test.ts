/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ArrayPropertiesField,
  Field,
  FieldDescriptor,
  FieldDescriptorType,
  NestedContentField,
  PropertiesField,
  StructPropertiesField,
} from "../../presentation-common/content/Fields.js";
import { PrimitiveTypeDescription, PropertyValueFormat } from "../../presentation-common/content/TypeDescription.js";
import { RelationshipMeaning } from "../../presentation-common/rules/content/modifiers/RelatedPropertiesSpecification.js";
import {
  createTestArrayPropertiesContentField,
  createTestCategoryDescription,
  createTestNestedContentField,
  createTestPropertiesContentField,
  createTestSimpleContentField,
  createTestStructPropertiesContentField,
} from "../_helpers/Content.js";
import { createTestECClassInfo, createTestPropertyInfo, createTestRelatedClassInfo } from "../_helpers/EC.js";

describe("Field", () => {
  describe("fromJSON", () => {
    /* eslint-disable @typescript-eslint/no-deprecated */
    it("creates valid Field from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestSimpleContentField({ category }).toJSON();
      const field = Field.fromJSON({ ...json }, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid PropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid ArrayPropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const itemType: PrimitiveTypeDescription = {
        valueFormat: PropertyValueFormat.Primitive,
        typeName: "string",
      };
      const json = createTestArrayPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
        type: {
          valueFormat: PropertyValueFormat.Array,
          typeName: `${itemType.typeName}[]`,
          memberType: itemType,
        },
        itemsField: createTestPropertiesContentField({
          properties: [{ property: createTestPropertyInfo() }],
          renderer: { name: "custom-renderer" },
          editor: { name: "custom-editor" },
        }),
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid StructPropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const memberType: PrimitiveTypeDescription = {
        valueFormat: PropertyValueFormat.Primitive,
        typeName: "string",
      };
      const json = createTestStructPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
        type: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: `MyStruct`,
          members: [
            {
              name: "member1",
              label: "Member One",
              type: memberType,
            },
          ],
        },
        memberFields: [
          createTestPropertiesContentField({
            properties: [{ property: createTestPropertyInfo() }],
            type: memberType,
          }),
        ],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Field.fromJSON(undefined, []);
      expect(item).to.be.undefined;
    });

    it("throws when creating field with category that doesn't exist in given list", () => {
      const category = createTestCategoryDescription();
      const json = createTestSimpleContentField({ category }).toJSON();
      expect(() => Field.fromJSON({ ...json, category: "does not exist" }, [category])).to.throw();
    });
    /* eslint-enable @typescript-eslint/no-deprecated */
  });

  describe("isPropertiesField", () => {
    it("returns false for non-properties field", () => {
      const field = createTestSimpleContentField();
      expect(field.isPropertiesField()).to.be.false;
    });

    it("returns true for properties field", () => {
      const field = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      expect(field.isPropertiesField()).to.be.true;
    });
  });

  describe("isNestedContentField", () => {
    it("returns false for non-nested content field", () => {
      const field = createTestSimpleContentField();
      expect(field.isNestedContentField()).to.be.false;
    });

    it("returns true for nested content field", () => {
      const field = createTestNestedContentField({
        nestedFields: [],
      });
      expect(field.isNestedContentField()).to.be.true;
    });
  });

  describe("getFieldDescriptor", () => {
    it("creates `NamedFieldDescriptor`", () => {
      const field = createTestSimpleContentField();
      expect(field.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Name,
        fieldName: field.name,
      });
    });
  });

  describe("matchesDescriptor", () => {
    it("returns `true` for matching descriptor", () => {
      const field = createTestSimpleContentField();
      expect(field.matchesDescriptor(field.getFieldDescriptor())).to.be.true;
    });

    it("returns `false` for non-matching descriptor", () => {
      const field = createTestSimpleContentField();
      const field2 = createTestSimpleContentField({ name: "x" });
      expect(field.matchesDescriptor(field2.getFieldDescriptor())).to.be.false;
    });
  });

  describe("clone", () => {
    it("returns exact copy of itself", () => {
      const field = createTestSimpleContentField();
      const clone = field.clone();
      expect(clone).to.be.instanceOf(Field);
      expect(clone).to.deep.eq(field);
    });
  });
});

describe("PropertiesField", () => {
  describe("fromJSON", () => {
    /* eslint-disable @typescript-eslint/no-deprecated */
    it("creates valid PropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
      }).toJSON();
      const field = PropertiesField.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const field = PropertiesField.fromJSON(undefined, []);
      expect(field).to.be.undefined;
    });

    it("creates valid PropertiesField from valid JSON with navigation property", () => {
      const category = createTestCategoryDescription();
      const json = createTestPropertiesContentField({
        category,
        properties: [
          {
            property: createTestPropertyInfo({
              navigationPropertyInfo: {
                classInfo: createTestECClassInfo(),
                isForwardRelationship: false,
                targetClassInfo: createTestECClassInfo(),
                isTargetPolymorphic: true,
              },
            }),
          },
        ],
      }).toJSON();
      const field = PropertiesField.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });
    /* eslint-enable @typescript-eslint/no-deprecated */
  });

  describe("parentArrayField", () => {
    it("throws when trying to set parent struct field, when field already has nested content parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.rebuildParentship(createTestNestedContentField({ nestedFields: [field] }));
      expect(() => (field.parentArrayField = createTestArrayPropertiesContentField({ properties: [] }))).to.throw();
    });

    it("throws when trying to set parent struct field, when field already has array parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.parentStructField = createTestStructPropertiesContentField({ properties: [] });
      expect(() => (field.parentArrayField = createTestArrayPropertiesContentField({ properties: [] }))).to.throw();
    });

    it("sets array parent field", () => {
      const itemsField = createTestPropertiesContentField({ properties: [] });
      const arrayField = createTestArrayPropertiesContentField({ properties: [] });
      itemsField.parentArrayField = arrayField;
      expect(itemsField.parentArrayField).to.eq(arrayField);
    });
  });

  describe("isArrayPropertiesField", () => {
    it("returns false for non-array properties field", () => {
      const field = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      });
      expect(field.isArrayPropertiesField()).to.be.false;
    });
  });

  describe("parentStructField", () => {
    it("throws when trying to set parent struct field, when field already has nested content parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.rebuildParentship(createTestNestedContentField({ nestedFields: [field] }));
      expect(() => (field.parentStructField = createTestStructPropertiesContentField({ properties: [] }))).to.throw();
    });

    it("throws when trying to set parent struct field, when field already has array parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.parentArrayField = createTestArrayPropertiesContentField({ properties: [] });
      expect(() => (field.parentStructField = createTestStructPropertiesContentField({ properties: [] }))).to.throw();
    });

    it("sets struct parent field", () => {
      const memberField = createTestPropertiesContentField({ properties: [] });
      const structField = createTestStructPropertiesContentField({ properties: [] });
      memberField.parentStructField = structField;
      expect(memberField.parentStructField).to.eq(structField);
    });
  });

  describe("isStructPropertiesField", () => {
    it("returns false", () => {
      const field = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      });
      expect(field.isStructPropertiesField()).to.be.false;
    });
  });

  describe("rebuildParentship", () => {
    it("throws when trying to set parent nested content field, when field already has struct parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.parentStructField = createTestStructPropertiesContentField({ properties: [] });
      expect(() => field.rebuildParentship(createTestNestedContentField({ nestedFields: [field] }))).to.throw();
    });

    it("throws when trying to set parent nested content field, when field already has array parent field", () => {
      const field = createTestPropertiesContentField({ properties: [] });
      field.parentArrayField = createTestArrayPropertiesContentField({ properties: [] });
      expect(() => field.rebuildParentship(createTestNestedContentField({ nestedFields: [field] }))).to.throw();
    });

    it("sets nested content parent field", () => {
      const childField = createTestPropertiesContentField({ properties: [] });
      const parentField = createTestNestedContentField({ nestedFields: [childField] });
      childField.rebuildParentship(parentField);
      expect(childField.parent).to.eq(parentField);
    });
  });

  describe("getFieldDescriptor", () => {
    it("creates `PropertiesFieldDescriptor` for root field", () => {
      const propertyInfo = createTestPropertyInfo();
      const field = createTestPropertiesContentField({
        properties: [{ property: propertyInfo }],
      });
      expect(field.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Properties,
        properties: [
          {
            class: propertyInfo.classInfo.name,
            name: propertyInfo.name,
          },
        ],
        pathFromSelectToPropertyClass: [],
      });
    });

    it("creates `PropertiesFieldDescriptor` for nested field", () => {
      const propertyInfo1 = createTestPropertyInfo({ name: "prop1" });
      const propertyInfo2 = createTestPropertyInfo({ name: "prop2" });
      const propertiesField = createTestPropertiesContentField({
        properties: [{ property: propertyInfo1 }, { property: propertyInfo2 }],
      });
      const parent1 = createTestNestedContentField({
        nestedFields: [propertiesField],
        pathToPrimaryClass: [
          createTestRelatedClassInfo({
            sourceClassInfo: createTestECClassInfo({ name: "a" }),
            relationshipInfo: createTestECClassInfo({ name: "a-b" }),
            targetClassInfo: createTestECClassInfo({ name: "b" }),
            isForwardRelationship: true,
            isPolymorphicRelationship: true,
            isPolymorphicTargetClass: true,
          }),
        ],
      });
      const parent2 = createTestNestedContentField({
        nestedFields: [parent1],
        pathToPrimaryClass: [
          createTestRelatedClassInfo({
            sourceClassInfo: createTestECClassInfo({ name: "c" }),
            relationshipInfo: createTestECClassInfo({ name: "c-d" }),
            targetClassInfo: createTestECClassInfo({ name: "d" }),
            isForwardRelationship: false,
            isPolymorphicRelationship: false,
            isPolymorphicTargetClass: false,
          }),
        ],
      });
      parent2.rebuildParentship();
      expect(propertiesField.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Properties,
        properties: [
          {
            class: propertyInfo1.classInfo.name,
            name: propertyInfo1.name,
          },
          {
            class: propertyInfo2.classInfo.name,
            name: propertyInfo2.name,
          },
        ],
        pathFromSelectToPropertyClass: [
          {
            sourceClassName: "d",
            relationshipName: "c-d",
            targetClassName: "c",
            isForwardRelationship: true,
          },
          {
            sourceClassName: "b",
            relationshipName: "a-b",
            targetClassName: "a",
            isForwardRelationship: false,
          },
        ],
      });
    });
  });

  describe("matchesDescriptor", () => {
    it("returns `false` for non-property descriptor", () => {
      const field = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      });
      expect(field.matchesDescriptor({ type: FieldDescriptorType.Name, fieldName: "x" })).to.be.false;
    });

    it("returns `false` if none of the properties match", () => {
      const field = createTestPropertiesContentField({
        properties: [
          {
            property: createTestPropertyInfo({
              name: "x",
              classInfo: createTestECClassInfo({ name: "x" }),
            }),
          },
        ],
      });
      expect(
        field.matchesDescriptor({
          type: FieldDescriptorType.Properties,
          properties: [{ name: "y", class: "y" }],
          pathFromSelectToPropertyClass: [],
        }),
      ).to.be.false;
    });

    it("returns `true` when at least one property matches", () => {
      const field = createTestPropertiesContentField({
        properties: [
          {
            property: createTestPropertyInfo({
              name: "x",
              classInfo: createTestECClassInfo({ name: "x" }),
            }),
          },
          {
            property: createTestPropertyInfo({
              name: "y",
              classInfo: createTestECClassInfo({ name: "y" }),
            }),
          },
        ],
      });
      expect(
        field.matchesDescriptor({
          type: FieldDescriptorType.Properties,
          properties: [
            { name: "y", class: "y" },
            { name: "z", class: "z" },
          ],
          pathFromSelectToPropertyClass: [],
        }),
      ).to.be.true;
    });

    it("returns `false` if relationship path doesn't match", () => {
      const field = createTestPropertiesContentField({
        properties: [
          {
            property: createTestPropertyInfo({
              name: "x",
              classInfo: createTestECClassInfo({ name: "x" }),
            }),
          },
        ],
      });
      createTestNestedContentField({
        nestedFields: [field],
        pathToPrimaryClass: [
          {
            sourceClassInfo: createTestECClassInfo({ name: "source:a" }),
            relationshipInfo: createTestECClassInfo({ name: "rel:a" }),
            targetClassInfo: createTestECClassInfo({ name: "target:a" }),
            isForwardRelationship: true,
          },
        ],
      });
      expect(
        field.matchesDescriptor({
          type: FieldDescriptorType.Properties,
          properties: [{ name: "x", class: "x" }],
          pathFromSelectToPropertyClass: [
            {
              sourceClassName: "bbb",
              relationshipName: "bbb",
              targetClassName: "bbb",
              isForwardRelationship: false,
            },
          ],
        }),
      ).to.be.false;
    });

    it("returns `false` if relationship path is longer than what's in descriptor", () => {
      const field = createTestPropertiesContentField({
        properties: [
          {
            property: createTestPropertyInfo({
              name: "x",
              classInfo: createTestECClassInfo({ name: "x" }),
            }),
          },
        ],
      });
      createTestNestedContentField({
        nestedFields: [field],
        pathToPrimaryClass: [
          {
            sourceClassInfo: createTestECClassInfo({ name: "source:a" }),
            relationshipInfo: createTestECClassInfo({ name: "rel:a" }),
            targetClassInfo: createTestECClassInfo({ name: "target:a" }),
            isForwardRelationship: true,
          },
          {
            sourceClassInfo: createTestECClassInfo({ name: "source:b" }),
            relationshipInfo: createTestECClassInfo({ name: "rel:b" }),
            targetClassInfo: createTestECClassInfo({ name: "target:b" }),
            isForwardRelationship: true,
          },
        ],
      });
      expect(
        field.matchesDescriptor({
          type: FieldDescriptorType.Properties,
          properties: [{ name: "x", class: "x" }],
          pathFromSelectToPropertyClass: [
            {
              sourceClassName: "target:b",
              relationshipName: "rel:b",
              targetClassName: "source:b",
              isForwardRelationship: false,
            },
          ],
        }),
      ).to.be.false;
    });

    it("returns `true` if property and relationship path matches", () => {
      const field = createTestPropertiesContentField({
        properties: [
          {
            property: createTestPropertyInfo({
              name: "x",
              classInfo: createTestECClassInfo({ name: "x" }),
            }),
          },
        ],
      });
      createTestNestedContentField({
        nestedFields: [field],
        pathToPrimaryClass: [
          {
            sourceClassInfo: createTestECClassInfo({ name: "source" }),
            relationshipInfo: createTestECClassInfo({ name: "rel" }),
            targetClassInfo: createTestECClassInfo({ name: "target" }),
            isForwardRelationship: true,
          },
        ],
      });
      expect(
        field.matchesDescriptor({
          type: FieldDescriptorType.Properties,
          properties: [{ name: "x", class: "x" }],
          pathFromSelectToPropertyClass: [
            {
              sourceClassName: "target",
              relationshipName: "rel",
              targetClassName: "source",
              isForwardRelationship: false,
            },
          ],
        }),
      ).to.be.true;
    });
  });

  describe("clone", () => {
    it("returns exact copy of itself", () => {
      const field = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(PropertiesField);
      expect(clone).to.deep.eq(field);
    });
  });
});

describe("ArrayPropertiesField", () => {
  describe("isArrayPropertiesField", () => {
    it("returns true", () => {
      const field = createTestArrayPropertiesContentField({
        properties: [{ property: createTestPropertyInfo({ type: "string[]" }) }],
        itemsField: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] }),
      });
      expect(field.isArrayPropertiesField()).to.be.true;
    });
  });

  describe("itemsField", () => {
    it("sets `arrayParentField` on items field, when creating ArrayPropertiesField", () => {
      const itemsField = createTestPropertiesContentField({ properties: [] });
      const field = createTestArrayPropertiesContentField({
        properties: [],
        itemsField,
      });
      expect(itemsField.parentArrayField).to.eq(field);
    });

    it("sets `arrayParentField` on items field, when it's set explicitly", () => {
      const itemsField = createTestPropertiesContentField({ properties: [] });
      const field = createTestArrayPropertiesContentField({ properties: [] });
      field.itemsField = itemsField;
      expect(itemsField.parentArrayField).to.eq(field);
    });
  });

  describe("clone", () => {
    it("returns exact copy of itself", () => {
      const itemsField = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      const field = createTestArrayPropertiesContentField({
        properties: [{ property: createTestPropertyInfo({ type: "string[]" }) }],
        itemsField,
      });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(ArrayPropertiesField);
      expect(clone).to.deep.eq(field);
      expect(clone.itemsField).to.not.eq(field.itemsField);
    });
  });
});

describe("StructPropertiesField", () => {
  describe("isStructPropertiesField", () => {
    it("returns true", () => {
      const field = createTestStructPropertiesContentField({
        properties: [{ property: createTestPropertyInfo({ type: "MyStruct" }) }],
      });
      expect(field.isStructPropertiesField()).to.be.true;
    });
  });

  describe("memberFields", () => {
    it("sets `parentStructField` on member fields, when creating StructPropertiesField", () => {
      const memberField1 = createTestPropertiesContentField({ properties: [] });
      const memberField2 = createTestPropertiesContentField({ properties: [] });
      const field = createTestStructPropertiesContentField({
        properties: [],
        memberFields: [memberField1, memberField2],
      });
      expect(memberField1.parentStructField).to.eq(field);
      expect(memberField2.parentStructField).to.eq(field);
    });

    it("sets `parentStructField` on member fields, when they're set explicitly", () => {
      const memberField1 = createTestPropertiesContentField({ properties: [] });
      const memberField2 = createTestPropertiesContentField({ properties: [] });
      const field = createTestStructPropertiesContentField({ properties: [] });
      field.memberFields = [memberField1, memberField2];
      expect(memberField1.parentStructField).to.eq(field);
      expect(memberField2.parentStructField).to.eq(field);
    });
  });

  describe("clone", () => {
    it("returns exact copy of itself", () => {
      const memberField = createTestPropertiesContentField({ properties: [] });
      const field = createTestStructPropertiesContentField({
        properties: [{ property: createTestPropertyInfo({ type: "MyStruct" }) }],
        memberFields: [memberField],
      });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(StructPropertiesField);
      expect(clone).to.deep.eq(field);
      expect(clone.memberFields[0]).to.not.eq(field.memberFields[0]);
    });
  });
});

describe("NestedContentField", () => {
  describe("getFieldByName", () => {
    it("returns undefined when there are no nested fields", () => {
      const field = createTestNestedContentField({ nestedFields: [] });
      expect(field.getFieldByName("test")).to.be.undefined;
    });

    it("returns undefined when field is not found", () => {
      const nested = createTestSimpleContentField();
      const field = createTestNestedContentField({ nestedFields: [nested] });
      expect(field.getFieldByName("does_not_exist", true)).to.be.undefined;
    });

    it("returns a field", () => {
      const nested = createTestSimpleContentField();
      const field = createTestNestedContentField({ nestedFields: [nested] });
      expect(field.getFieldByName(nested.name)).to.eq(nested);
    });
  });

  describe("fromJSON", () => {
    /* eslint-disable @typescript-eslint/no-deprecated */
    it("creates valid NestedContentField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
        autoExpand: true,
      }).toJSON();
      const field = NestedContentField.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid JSON with `relationshipMeaning`", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
        relationshipMeaning: RelationshipMeaning.SameInstance,
      }).toJSON();
      const field = NestedContentField.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = NestedContentField.fromJSON(undefined, []);
      expect(item).to.be.undefined;
    });
    /* eslint-enable @typescript-eslint/no-deprecated */
  });

  describe("rebuildParentship / resetParentship", () => {
    it("creates and resets parentship of self and nested fields", () => {
      const field1 = createTestSimpleContentField();
      const field2 = createTestNestedContentField({ nestedFields: [field1] });
      const field3 = createTestNestedContentField({ nestedFields: [field2] });

      field2.rebuildParentship(field3);
      expect(field3.parent).to.be.undefined;
      expect(field2.parent).to.eq(field3);
      expect(field1.parent).to.eq(field2);

      field3.resetParentship();
      expect(field3.parent).to.be.undefined;
      expect(field2.parent).to.be.undefined;
      expect(field1.parent).to.be.undefined;
    });
  });

  describe("clone", () => {
    it("returns exact copy of itself", () => {
      const field = createTestNestedContentField({ nestedFields: [createTestSimpleContentField()] });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(NestedContentField);
      expect(clone).to.deep.eq(field);
    });
  });
});

describe("FieldDescriptor", () => {
  describe("type guards", () => {
    it("correctly checks 'Name' descriptor", () => {
      expect(
        FieldDescriptor.isNamed({
          type: FieldDescriptorType.Name,
          fieldName: "test",
        }),
      ).to.be.true;
      expect(
        FieldDescriptor.isNamed({
          type: FieldDescriptorType.Properties,
          properties: [],
          pathFromSelectToPropertyClass: [],
        }),
      ).to.be.false;
    });

    it("correctly checks 'Properties' descriptor", () => {
      expect(
        FieldDescriptor.isProperties({
          type: FieldDescriptorType.Name,
          fieldName: "test",
        }),
      ).to.be.false;
      expect(
        FieldDescriptor.isProperties({
          type: FieldDescriptorType.Properties,
          properties: [
            {
              class: "test",
              name: "",
            },
          ],
          pathFromSelectToPropertyClass: [],
        }),
      ).to.be.true;
    });
  });
});
