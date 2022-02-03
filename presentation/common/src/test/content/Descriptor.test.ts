/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import type { Id64String } from "@itwin/core-bentley";
import { CategoryDescription } from "../../presentation-common/content/Category";
import type { DescriptorJSON, DescriptorSource, SelectClassInfoJSON} from "../../presentation-common/content/Descriptor";
import {
  Descriptor, SelectClassInfo, SortDirection,
} from "../../presentation-common/content/Descriptor";
import type { Field} from "../../presentation-common/content/Fields";
import { FieldDescriptorType } from "../../presentation-common/content/Fields";
import { PropertyValueFormat } from "../../presentation-common/content/TypeDescription";
import type { CompressedClassInfoJSON, RelatedClassInfoJSON } from "../../presentation-common/EC";
import { RelatedClassInfo } from "../../presentation-common/EC";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestNestedContentField, createTestPropertiesContentField,
  createTestSelectClassInfo, createTestSimpleContentField,
} from "../_helpers/Content";
import { createTestPropertyInfo, createTestRelatedClassInfo, createTestRelationshipPath } from "../_helpers/EC";

describe("Descriptor", () => {

  describe("constructor", () => {

    it("creates Descriptor from DescriptorSource without categories", () => {
      const category = createTestCategoryDescription();
      const source: DescriptorSource = {
        contentFlags: 9,
        displayType: faker.random.word(),
        categories: [category],
        fields: [createTestSimpleContentField({ category }), createTestSimpleContentField({ category })],
        filterExpression: faker.random.words(),
        selectClasses: [],
      };
      const descriptor = new Descriptor(source);
      for (const key in source) {
        if (source.hasOwnProperty(key))
          expect((descriptor as any)[key]).to.deep.eq((source as any)[key]);
      }
    });

    it("creates Descriptor from DescriptorSource with categories", () => {
      const category = createTestCategoryDescription();
      const source: DescriptorSource = {
        contentFlags: 9,
        displayType: faker.random.word(),
        categories: [category],
        fields: [createTestSimpleContentField({ category }), createTestSimpleContentField({ category })],
        filterExpression: faker.random.words(),
        selectClasses: [],
      };
      const descriptor = new Descriptor(source);
      for (const key in source) {
        if (source.hasOwnProperty(key))
          expect((descriptor as any)[key]).to.deep.eq((source as any)[key]);
      }
    });

  });

  describe("fromJSON", () => {

    const validateParentship = (fields: Field[], parent?: Field) => {
      fields.forEach((field) => {
        expect(field.parent).to.eq(parent);
        if (field.isNestedContentField())
          validateParentship(field.nestedFields, field);
      });
    };

    it("creates valid Descriptor from valid JSON", () => {
      const category = createTestCategoryDescription();
      const ids = ["0x1", "0x2", "0x3", "0x4"];
      const testRelatedClassInfo: RelatedClassInfoJSON<string> = {
        sourceClassInfo: ids[1],
        targetClassInfo: ids[2],
        relationshipInfo: ids[3],
        isForwardRelationship: true,
      };
      const json: DescriptorJSON = {
        connectionId: "",
        categories: [CategoryDescription.toJSON(category)],
        contentFlags: 0,
        contentOptions: 0,
        displayType: "",
        inputKeysHash: "",
        classesMap: {
          [ids[0]]: { name: "name1", label: "label1" },
          [ids[1]]: { name: "name2", label: "label2" },
          [ids[2]]: { name: "name3", label: "label3" },
          [ids[3]]: { name: "name4", label: "label4" },
        },
        selectClasses: [{
          selectClassInfo: ids[0],
          isSelectPolymorphic: true,
          pathFromInputToSelectClass: [testRelatedClassInfo],
          relatedPropertyPaths: [[testRelatedClassInfo]],
          navigationPropertyClasses: [testRelatedClassInfo],
          relatedInstancePaths: [[testRelatedClassInfo]],
        }],
        fields: [{
          name: "test-simple-field",
          label: "Test Simple Field",
          type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          category: category.name,
          isReadonly: false,
          priority: 0,
        }, {
          name: "test-properties-field",
          label: "Test Properties Field",
          type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
          category: category.name,
          isReadonly: false,
          priority: 0,
          properties: [{
            property: {
              classInfo: ids[0],
              name: "PropertyName",
              type: "TestPropertyType",
            },
          }],
        }, {
          name: "test-nested-content-field",
          label: "Test Nested Content Field",
          type: {
            valueFormat: PropertyValueFormat.Struct,
            typeName: "StructType",
            members: [{
              type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
              name: "StringType",
              label: "String Type",
            }],
          },
          category: category.name,
          isReadonly: false,
          priority: 0,
          contentClassInfo: ids[1],
          pathToPrimaryClass: [testRelatedClassInfo],
          nestedFields: [{
            name: "test-nested-properties-field",
            label: "Test Nested Properties Field",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
            category: category.name,
            isReadonly: false,
            priority: 0,
            properties: [{
              property: {
                classInfo: ids[1],
                name: "NestedPropertyName",
                type: "TestNestedPropertyType",
              },
            }],
          }],
          autoExpand: false,
        }],
      };
      const descriptor = Descriptor.fromJSON(json);
      validateParentship(descriptor!.fields);
      expect(descriptor).to.matchSnapshot();
    });

    it("skips fields that fail to deserialize", () => {
      const category = createTestCategoryDescription();
      const json: DescriptorJSON = {
        connectionId: "",
        categories: [CategoryDescription.toJSON(category)],
        contentFlags: 0,
        contentOptions: 0,
        displayType: "",
        inputKeysHash: "",
        selectClasses: [],
        classesMap: {},
        fields: [
          createTestSimpleContentField({ category }).toJSON(),
          undefined as any,
        ],
      };
      const descriptor = Descriptor.fromJSON(json);
      expect(descriptor!.fields.length).to.eq(1);
    });

    it("returns undefined for undefined JSON", () => {
      const descriptor = Descriptor.fromJSON(undefined);
      expect(descriptor).to.be.undefined;
    });

  });

  describe("toJSON", () => {

    it("creates valid CompressedDescriptorJSON", () => {
      const category = createTestCategoryDescription();
      const fields = [
        createTestSimpleContentField(),
        createTestPropertiesContentField({
          category,
          properties: [{ property: createTestPropertyInfo() }],
        }),
        createTestNestedContentField({
          category,
          nestedFields: [createTestSimpleContentField()],
        }),
      ];
      const descriptor = createTestContentDescriptor({
        selectClasses: [createTestSelectClassInfo({
          pathFromInputToSelectClass: [createTestRelatedClassInfo()],
          navigationPropertyClasses: [createTestRelatedClassInfo()],
          relatedInstancePaths: [[createTestRelatedClassInfo()]],
          relatedPropertyPaths: [[createTestRelatedClassInfo()]],
        })],
        categories: [category],
        fields,
        filterExpression: "testFilterExpression",
        selectionInfo: { providerName: "testProviderName", level: 1 },
        sortingField: fields[0],
        sortDirection: SortDirection.Ascending,
      });
      expect(descriptor.toJSON()).to.matchSnapshot();
    });

  });

  describe("getFieldByName", () => {

    it("returns undefined when there are no fields", () => {
      const descriptor = createTestContentDescriptor({ fields: [] });
      expect(descriptor.getFieldByName("test")).to.be.undefined;
    });

    it("returns undefined when field is not found", () => {
      const descriptor = createTestContentDescriptor({ fields: [createTestSimpleContentField()] });
      expect(descriptor.getFieldByName("does-not-exist", true)).to.be.undefined;
    });

    it("returns a field", () => {
      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({ fields: [field] });
      expect(descriptor.getFieldByName(field.name)).to.eq(field);
    });

    it("returns undefined when descriptor contains nested fields but field is not found", () => {
      const primitiveField = createTestSimpleContentField();
      const nestedContentField = createTestNestedContentField({
        nestedFields: [primitiveField],
      });
      const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
      expect(descriptor.getFieldByName("does not exist", true)).to.be.undefined;
    });

    it("returns a nested field", () => {
      const primitiveField = createTestSimpleContentField();
      const nestedContentField = createTestNestedContentField({
        nestedFields: [primitiveField],
      });
      const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
      expect(descriptor.getFieldByName(primitiveField.name, true)).to.eq(primitiveField);
    });

  });

  describe("createDescriptorOverrides", () => {

    it("creates a valid object with default parameters", () => {
      const descriptor = createTestContentDescriptor({
        fields: [],
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({});
    });

    it("creates a valid object with display type", () => {
      const descriptor = createTestContentDescriptor({
        fields: [],
        displayType: "test display type",
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({
        displayType: "test display type",
      });
    });

    it("creates a valid object with content flags", () => {
      const descriptor = createTestContentDescriptor({
        fields: [],
        contentFlags: 123,
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({
        contentFlags: 123,
      });
    });

    it("creates a valid object with filter expression", () => {
      const descriptor = createTestContentDescriptor({
        fields: [],
        filterExpression: "test filter",
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({
        filterExpression: "test filter",
      });
    });

    it("creates a valid object with sorting field ascending", () => {
      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({
        fields: [field],
        sortingField: field,
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({
        sorting: {
          field: { type: FieldDescriptorType.Name, fieldName: field.name },
          direction: SortDirection.Ascending,
        },
      });
    });

    it("creates a valid object with sorting field descending", () => {
      const field = createTestSimpleContentField();
      const descriptor = createTestContentDescriptor({
        fields: [field],
        sortingField: field,
        sortDirection: SortDirection.Descending,
      });
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({
        sorting: {
          field: { type: FieldDescriptorType.Name, fieldName: field.name },
          direction: SortDirection.Descending,
        },
      });
    });

  });

});

describe("SelectClassInfo", () => {

  let classesMap!: { [id: string]: CompressedClassInfoJSON };
  let obj!: SelectClassInfo;
  let compressedJson!: SelectClassInfoJSON<Id64String>;

  beforeEach(() => {
    obj = {
      selectClassInfo: {
        id: "0x123",
        name: "name",
        label: "Label",
      },
      isSelectPolymorphic: true,
    };
    compressedJson = {
      selectClassInfo: "0x123",
      isSelectPolymorphic: true,
    };
    classesMap = {
      ["0x123"]: {
        name: "name",
        label: "Label",
      },
    };
  });

  describe("fromCompressedJSON", () => {

    it("doesn't create unnecessary members", () => {
      const result = SelectClassInfo.fromCompressedJSON(compressedJson, classesMap);
      expect(result).to.not.haveOwnProperty("pathFromInputToSelectClass");
      expect(result).to.not.haveOwnProperty("relatedPropertyPaths");
      expect(result).to.not.haveOwnProperty("navigationPropertyClasses");
      expect(result).to.not.haveOwnProperty("relatedInstancePaths");
    });

    it("parses `pathFromInputToSelectClass`", () => {
      const pathFromInputToSelectClass = createTestRelationshipPath(2);
      compressedJson = {
        ...compressedJson,
        pathFromInputToSelectClass: pathFromInputToSelectClass.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap)),
      };
      expect(SelectClassInfo.fromCompressedJSON(compressedJson, classesMap)).to.deep.eq({
        ...obj,
        pathFromInputToSelectClass,
      });
    });

    it("parses `relatedPropertyPaths`", () => {
      const relatedPropertyPaths = [createTestRelationshipPath(2)];
      compressedJson = {
        ...compressedJson,
        relatedPropertyPaths: relatedPropertyPaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, classesMap))),
      };
      expect(SelectClassInfo.fromCompressedJSON(compressedJson, classesMap)).to.deep.eq({
        ...obj,
        relatedPropertyPaths,
      });
    });

    it("parses `navigationPropertyClasses`", () => {
      const navigationPropertyClasses = createTestRelationshipPath(2);
      compressedJson = {
        ...compressedJson,
        navigationPropertyClasses: navigationPropertyClasses.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap)),
      };
      expect(SelectClassInfo.fromCompressedJSON(compressedJson, classesMap)).to.deep.eq({
        ...obj,
        navigationPropertyClasses,
      });
    });

    it("parses `relatedInstancePaths`", () => {
      const relatedInstancePaths = [createTestRelationshipPath(2)];
      compressedJson = {
        ...compressedJson,
        relatedInstancePaths: relatedInstancePaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, classesMap))),
      };
      expect(SelectClassInfo.fromCompressedJSON(compressedJson, classesMap)).to.deep.eq({
        ...obj,
        relatedInstancePaths,
      });
    });

  });

  describe("toCompressedJSON", () => {

    it("doesn't create unnecessary members", () => {
      const actualCompressedJson = SelectClassInfo.toCompressedJSON(obj, {});
      expect(actualCompressedJson).to.not.haveOwnProperty("pathFromInputToSelectClass");
      expect(actualCompressedJson).to.not.haveOwnProperty("relatedPropertyPaths");
      expect(actualCompressedJson).to.not.haveOwnProperty("navigationPropertyClasses");
      expect(actualCompressedJson).to.not.haveOwnProperty("relatedInstancePaths");
    });

    it("serializes `pathFromInputToSelectClass`", () => {
      const actualClassesMap = {};
      const pathFromInputToSelectClass = createTestRelationshipPath(2);
      obj = {
        ...obj,
        pathFromInputToSelectClass,
      };
      expect(SelectClassInfo.toCompressedJSON(obj, actualClassesMap)).to.deep.eq({
        ...compressedJson,
        pathFromInputToSelectClass: pathFromInputToSelectClass.map((p) => RelatedClassInfo.toCompressedJSON(p, {})),
      });
      expect(actualClassesMap).to.containSubset(classesMap);
    });

    it("serializes `relatedPropertyPaths`", () => {
      const actualClassesMap = {};
      const relatedPropertyPaths = [createTestRelationshipPath(2)];
      obj = {
        ...obj,
        relatedPropertyPaths,
      };
      expect(SelectClassInfo.toCompressedJSON(obj, actualClassesMap)).to.deep.eq({
        ...compressedJson,
        relatedPropertyPaths: relatedPropertyPaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, {}))),
      });
      expect(actualClassesMap).to.containSubset(classesMap);
    });

    it("serializes `navigationPropertyClasses`", () => {
      const actualClassesMap = {};
      const navigationPropertyClasses = createTestRelationshipPath(2);
      obj = {
        ...obj,
        navigationPropertyClasses,
      };
      expect(SelectClassInfo.toCompressedJSON(obj, actualClassesMap)).to.deep.eq({
        ...compressedJson,
        navigationPropertyClasses: navigationPropertyClasses.map((p) => RelatedClassInfo.toCompressedJSON(p, {})),
      });
      expect(actualClassesMap).to.containSubset(classesMap);
    });

    it("serializes `relatedInstancePaths`", () => {
      const actualClassesMap = {};
      const relatedInstancePaths = [createTestRelationshipPath(2)];
      obj = {
        ...obj,
        relatedInstancePaths,
      };
      expect(SelectClassInfo.toCompressedJSON(obj, actualClassesMap)).to.deep.eq({
        ...compressedJson,
        relatedInstancePaths: relatedInstancePaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, {}))),
      });
      expect(actualClassesMap).to.containSubset(classesMap);
    });

  });

  describe("listFromCompressedJSON", () => {

    it("creates valid SelectClassInfo[] from compressed JSON", () => {
      const result = SelectClassInfo.listFromCompressedJSON([compressedJson], classesMap);
      expect(result).to.deep.equal([obj]);
    });

  });

});
