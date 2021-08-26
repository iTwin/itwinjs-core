/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Id64String } from "@bentley/bentleyjs-core";
import {
  CompressedDescriptorJSON, Descriptor, DescriptorJSON, DescriptorSource, SelectClassInfo, SelectClassInfoJSON, SortDirection,
} from "../../presentation-common/content/Descriptor";
import {
  Field, FieldDescriptorType, FieldJSON, NestedContentField, NestedContentFieldJSON, PropertiesFieldJSON,
} from "../../presentation-common/content/Fields";
import { PropertyValueFormat, StructTypeDescription } from "../../presentation-common/content/TypeDescription";
import { ClassInfo, RelatedClassInfo, RelatedClassInfoJSON } from "../../presentation-common/EC";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestNestedContentField, createTestPropertiesContentField,
  createTestSelectClassInfo, createTestSimpleContentField,
} from "../_helpers/Content";
import { createTestECClassInfo, createTestPropertyInfo, createTestRelatedClassInfo, createTestRelationshipPath } from "../_helpers/EC";
import {
  createRandomCategory, createRandomCategoryJSON, createRandomDescriptor, createRandomDescriptorJSON, createRandomECClassInfo,
  createRandomNestedFieldJSON, createRandomPrimitiveField, createRandomPrimitiveFieldJSON, createRandomPrimitiveTypeDescription,
  createRandomRelationshipPath,
} from "../_helpers/random";

describe("Descriptor", () => {

  describe("constructor", () => {

    it("creates Descriptor from DescriptorSource without categories", () => {
      const category = createRandomCategory();
      const source: DescriptorSource = {
        contentFlags: 9,
        displayType: faker.random.word(),
        fields: [createRandomPrimitiveField(category), createRandomPrimitiveField(category)],
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
      const category = createRandomCategory();
      const source: DescriptorSource = {
        contentFlags: 9,
        displayType: faker.random.word(),
        categories: [category],
        fields: [createRandomPrimitiveField(category), createRandomPrimitiveField(category)],
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

    let testDescriptorJSON!: DescriptorJSON;
    beforeEach(() => {
      testDescriptorJSON = createRandomDescriptorJSON();
      testDescriptorJSON.fields.push(createRandomNestedFieldJSON(testDescriptorJSON.categories![0]));
    });

    const validateParentship = (fields: Field[], parent?: Field) => {
      fields.forEach((field) => {
        expect(field.parent).to.eq(parent);
        if (field.isNestedContentField())
          validateParentship(field.nestedFields, field);
      });
    };

    it("creates valid Descriptor from valid JSON with categories", () => {
      const descriptor = Descriptor.fromJSON(testDescriptorJSON);
      validateParentship(descriptor!.fields);
      expect(descriptor).to.matchSnapshot();
    });

    it("creates valid Descriptor from valid JSON without categories", () => {
      testDescriptorJSON.fields.forEach((field) => field.category = createRandomCategoryJSON());
      const descriptor = Descriptor.fromJSON({ ...testDescriptorJSON, categories: undefined });
      validateParentship(descriptor!.fields);
      expect(descriptor).to.matchSnapshot();
    });

    it("creates valid Descriptor from valid serialized JSON", () => {
      const descriptor = Descriptor.fromJSON(JSON.stringify(testDescriptorJSON));
      validateParentship(descriptor!.fields);
      expect(descriptor).to.matchSnapshot();
    });

    it("creates valid Descriptor from CompressedDescriptorJSON", () => {
      const testCategory = createRandomCategoryJSON();
      const ids = ["0x1", "0x2", "0x3", "0x4"];
      const testRelatedClassInfo: RelatedClassInfoJSON<string> = {
        sourceClassInfo: ids[1],
        targetClassInfo: ids[2],
        relationshipInfo: ids[3],
        isForwardRelationship: true,
      };
      const fields: FieldJSON<string>[] = [{
        ...createRandomPrimitiveFieldJSON(testCategory),
        properties: [{
          property: {
            classInfo: ids[0],
            name: faker.lorem.words(),
            type: faker.lorem.words(),
          },
          relatedClassPath: [testRelatedClassInfo],
        }],
      } as PropertiesFieldJSON<string>, {
        ...createRandomPrimitiveFieldJSON(testCategory),
        type: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            type: createRandomPrimitiveTypeDescription(),
            name: faker.random.word(),
            label: faker.random.word(),
          }],
        } as StructTypeDescription,
        contentClassInfo: ids[1],
        pathToPrimaryClass: [testRelatedClassInfo],
        nestedFields: [createRandomPrimitiveFieldJSON(testCategory)],
        autoExpand: false,
      } as NestedContentFieldJSON<string>];

      const testCompressedDescriptorJSON: CompressedDescriptorJSON = {
        connectionId: faker.random.uuid(),
        inputKeysHash: faker.random.uuid(),
        contentOptions: faker.random.objectElement(),
        displayType: faker.lorem.words(),
        selectClasses: [{
          selectClassInfo: ids[0],
          isSelectPolymorphic: true,
          pathToPrimaryClass: [testRelatedClassInfo],
          relatedPropertyPaths: [[testRelatedClassInfo]],
          navigationPropertyClasses: [testRelatedClassInfo],
          relatedInstanceClasses: [testRelatedClassInfo],
        }],
        categories: [testCategory],
        fields,
        contentFlags: 0,
        classesMap: {
          [ids[0]]: { name: "name1", label: "label1" },
          [ids[1]]: { name: "name2", label: "label2" },
          [ids[2]]: { name: "name3", label: "label3" },
          [ids[3]]: { name: "name4", label: "label4" },
        },
      };
      const descriptorFromCompressedJSON = Descriptor.fromJSON(JSON.stringify(testCompressedDescriptorJSON));
      expect(descriptorFromCompressedJSON).to.matchSnapshot();
    });

    it("skips fields that fail to deserialize", () => {
      testDescriptorJSON.fields = [createRandomPrimitiveFieldJSON(testDescriptorJSON.categories![0]), undefined as any];
      const descriptor = Descriptor.fromJSON(testDescriptorJSON);
      expect(descriptor!.fields.length).to.eq(1);
    });

    it("returns undefined for undefined JSON", () => {
      const descriptor = Descriptor.fromJSON(undefined);
      expect(descriptor).to.be.undefined;
    });

  });

  describe("toCompressedJSON", () => {

    it("creates valid CompressedDescriptorJSON", () => {
      const category = createTestCategoryDescription();
      const fields = [
        createTestSimpleContentField(),
        createTestPropertiesContentField({
          category,
          properties: [{ property: createTestPropertyInfo(), relatedClassPath: [createTestRelatedClassInfo()] }],
        }),
        createTestNestedContentField({
          category,
          nestedFields: [createTestSimpleContentField()],
        }),
      ];
      const descriptor = createTestContentDescriptor({
        selectClasses: [createTestSelectClassInfo({
          pathToPrimaryClass: [createTestRelatedClassInfo()],
          navigationPropertyClasses: [createTestRelatedClassInfo()],
          relatedInstanceClasses: [createTestRelatedClassInfo()],
          relatedPropertyPaths: [[createTestRelatedClassInfo()]],
        })],
        categories: [category],
        fields,
        filterExpression: "testFilterExpression",
        selectionInfo: { providerName: "testProviderName", level: 1 },
        sortingField: fields[0],
        sortDirection: SortDirection.Ascending,
      });
      expect(descriptor.toCompressedJSON()).to.matchSnapshot();
    });

  });

  describe("getFieldByName", () => {

    it("returns undefined when there are no fields", () => {
      const descriptor = createRandomDescriptor("type", []);
      expect(descriptor.getFieldByName("test")).to.be.undefined;
    });

    it("returns undefined when field is not found", () => {
      const descriptor = createRandomDescriptor();
      const name = descriptor.fields.map((f) => f.name).join();
      expect(descriptor.getFieldByName(name, true)).to.be.undefined;
    });

    it("returns a field", () => {
      const descriptor = createRandomDescriptor();
      const field = descriptor.fields[0];
      expect(descriptor.getFieldByName(field.name)).to.eq(field);
    });

    it("returns undefined when descriptor contains nested fields but field is not found", () => {
      const descriptor = createRandomDescriptor();
      const primitiveField = createRandomPrimitiveField();
      const descr: StructTypeDescription = {
        valueFormat: PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          type: primitiveField.type,
          label: primitiveField.label,
          name: primitiveField.name,
        }],
      };
      const nestedField = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), descr, faker.random.boolean(), faker.random.number(),
        createRandomECClassInfo(), createRandomRelationshipPath(), [primitiveField], undefined, faker.random.boolean());
      descriptor.fields.push(nestedField);
      expect(descriptor.getFieldByName("does not exist", true)).to.be.undefined;
    });

    it("returns a nested field", () => {
      const descriptor = createRandomDescriptor();
      const primitiveField = createRandomPrimitiveField();
      const descr: StructTypeDescription = {
        valueFormat: PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          type: primitiveField.type,
          label: primitiveField.label,
          name: primitiveField.name,
        }],
      };
      const nestedField = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), descr, faker.random.boolean(), faker.random.number(),
        createRandomECClassInfo(), createRandomRelationshipPath(), [primitiveField], undefined, faker.random.boolean());
      descriptor.fields.push(nestedField);
      expect(descriptor.getFieldByName(primitiveField.name, true)).to.eq(primitiveField);
    });

  });

  describe("createDescriptorOverrides", () => {

    it("creates a valid object with default parameters", () => {
      const descriptor = createRandomDescriptor("");
      expect(descriptor.createDescriptorOverrides()).to.deep.eq({});
    });

    it("creates a valid object with display type", () => {
      const descriptorJSON = {
        ...createRandomDescriptorJSON(),
        displayType: "test display type",
      };
      const descriptor = Descriptor.fromJSON(descriptorJSON)!;
      const overrides = descriptor.createDescriptorOverrides();
      expect(overrides).to.deep.eq({
        displayType: descriptorJSON.displayType,
      });
    });

    it("creates a valid object with content flags", () => {
      const descriptorJSON = {
        ...createRandomDescriptorJSON(""),
        contentFlags: 123,
      };
      const descriptor = Descriptor.fromJSON(descriptorJSON)!;
      const overrides = descriptor.createDescriptorOverrides();
      expect(overrides).to.deep.eq({
        contentFlags: descriptorJSON.contentFlags,
      });
    });

    it("creates a valid object with filter expression", () => {
      const descriptorJSON = {
        ...createRandomDescriptorJSON(""),
        filterExpression: "test filter",
      };
      const descriptor = Descriptor.fromJSON(descriptorJSON)!;
      const overrides = descriptor.createDescriptorOverrides();
      expect(overrides).to.deep.eq({
        filterExpression: descriptorJSON.filterExpression,
      });
    });

    it("creates a valid object with sorting field ascending", () => {
      const categoryJSON = createRandomCategoryJSON();
      const fieldJSON = createRandomPrimitiveFieldJSON(categoryJSON.name);
      const descriptorJSON = {
        ...createRandomDescriptorJSON("", [fieldJSON], [categoryJSON]),
        sortingFieldName: fieldJSON.name,
      };
      const descriptor = Descriptor.fromJSON(descriptorJSON)!;
      const overrides = descriptor.createDescriptorOverrides();
      expect(overrides).to.deep.eq({
        sorting: {
          field: { type: FieldDescriptorType.Name, fieldName: descriptorJSON.sortingFieldName },
          direction: SortDirection.Ascending,
        },
      });
    });

    it("creates a valid object with sorting field descending", () => {
      const fieldJSON = createRandomPrimitiveFieldJSON(createRandomCategoryJSON());
      const descriptorJSON = {
        ...createRandomDescriptorJSON("", [fieldJSON]),
        categories: undefined,
        sortingFieldName: fieldJSON.name,
        sortDirection: SortDirection.Descending,
      };
      const descriptor = Descriptor.fromJSON(descriptorJSON)!;
      const overrides = descriptor.createDescriptorOverrides();
      expect(overrides).to.deep.eq({
        sorting: {
          field: { type: FieldDescriptorType.Name, fieldName: descriptorJSON.sortingFieldName },
          direction: SortDirection.Descending,
        },
      });
    });

  });

});

describe("SelectClassInfo", () => {

  const testSelectClassInfo = {
    selectClassInfo: createTestECClassInfo({ id: "0x123" }),
    isSelectPolymorphic: true,
    pathToPrimaryClass: [],
    navigationPropertyClasses: [],
    relatedInstanceClasses: [],
    relatedPropertyPaths: [],
  };

  describe("fromJSON", () => {

    it("doesn't create unnecessary members", () => {
      const json: SelectClassInfoJSON = {
        ...testSelectClassInfo,
        selectClassInfo: ClassInfo.toJSON(testSelectClassInfo.selectClassInfo),
      };
      const result = SelectClassInfo.fromJSON(json);
      expect(result).to.not.haveOwnProperty("pathFromInputToSelectClass");
      expect(result).to.not.haveOwnProperty("relatedInstancePaths");
    });

    it("parses `pathFromInputToSelectClass`", () => {
      const pathFromInputToSelectClass = createTestRelationshipPath(2);
      const json: SelectClassInfoJSON = {
        ...testSelectClassInfo,
        selectClassInfo: ClassInfo.toJSON(testSelectClassInfo.selectClassInfo),
        pathFromInputToSelectClass: pathFromInputToSelectClass.map(RelatedClassInfo.toJSON),
      };
      expect(SelectClassInfo.fromJSON(json)).to.deep.eq({
        ...testSelectClassInfo,
        pathFromInputToSelectClass,
      });
    });

    it("parses `relatedInstancePaths`", () => {
      const relatedInstancePaths = [createTestRelationshipPath(2)];
      const json: SelectClassInfoJSON = {
        ...testSelectClassInfo,
        selectClassInfo: ClassInfo.toJSON(testSelectClassInfo.selectClassInfo),
        relatedInstancePaths: relatedInstancePaths.map((p) => p.map(RelatedClassInfo.toJSON)),
      };
      expect(SelectClassInfo.fromJSON(json)).to.deep.eq({
        ...testSelectClassInfo,
        relatedInstancePaths,
      });
    });

  });

  describe("fromCompressedJSON", () => {

    it("doesn't create unnecessary members", () => {
      const classesMap = {
        [testSelectClassInfo.selectClassInfo.id]: {
          name: testSelectClassInfo.selectClassInfo.name,
          label: testSelectClassInfo.selectClassInfo.label,
        },
      };
      const json: SelectClassInfoJSON<Id64String> = {
        ...testSelectClassInfo,
        selectClassInfo: testSelectClassInfo.selectClassInfo.id,
      };
      const result = SelectClassInfo.fromCompressedJSON(json, classesMap);
      expect(result).to.not.haveOwnProperty("pathFromInputToSelectClass");
      expect(result).to.not.haveOwnProperty("relatedInstancePaths");
    });

    it("parses `pathFromInputToSelectClass`", () => {
      const classesMap = {
        [testSelectClassInfo.selectClassInfo.id]: {
          name: testSelectClassInfo.selectClassInfo.name,
          label: testSelectClassInfo.selectClassInfo.label,
        },
      };
      const pathFromInputToSelectClass = createTestRelationshipPath(1);
      const json: SelectClassInfoJSON<Id64String> = {
        ...testSelectClassInfo,
        selectClassInfo: testSelectClassInfo.selectClassInfo.id,
        pathFromInputToSelectClass: pathFromInputToSelectClass.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap)),
      };
      expect(SelectClassInfo.fromCompressedJSON(json, classesMap)).to.deep.eq({
        ...testSelectClassInfo,
        pathFromInputToSelectClass,
      });
    });

    it("parses `relatedInstancePaths`", () => {
      const classesMap = {
        [testSelectClassInfo.selectClassInfo.id]: {
          name: testSelectClassInfo.selectClassInfo.name,
          label: testSelectClassInfo.selectClassInfo.label,
        },
      };
      const relatedInstancePaths = [createTestRelationshipPath(1)];
      const json: SelectClassInfoJSON<Id64String> = {
        ...testSelectClassInfo,
        selectClassInfo: testSelectClassInfo.selectClassInfo.id,
        relatedInstancePaths: relatedInstancePaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, classesMap))),
      };
      expect(SelectClassInfo.fromCompressedJSON(json, classesMap)).to.deep.eq({
        ...testSelectClassInfo,
        relatedInstancePaths,
      });
    });

  });

  describe("toCompressedJSON", () => {

    it("doesn't create unnecessary members", () => {
      const classesMap = {};
      const info: SelectClassInfo = {
        ...testSelectClassInfo,
      };
      const json = SelectClassInfo.toCompressedJSON(info, classesMap);
      expect(json).to.not.haveOwnProperty("pathFromInputToSelectClass");
      expect(json).to.not.haveOwnProperty("relatedInstancePaths");
    });

    it("serializes `pathFromInputToSelectClass`", () => {
      const classesMap = {};
      const pathFromInputToSelectClass = createTestRelationshipPath(1);
      const info: SelectClassInfo = {
        ...testSelectClassInfo,
        pathFromInputToSelectClass,
      };
      expect(SelectClassInfo.toCompressedJSON(info, classesMap)).to.deep.eq({
        ...testSelectClassInfo,
        selectClassInfo: testSelectClassInfo.selectClassInfo.id,
        pathFromInputToSelectClass: pathFromInputToSelectClass.map((p) => RelatedClassInfo.toCompressedJSON(p, {})),
      });
    });

    it("serializes `relatedInstancePaths`", () => {
      const classesMap = {};
      const relatedInstancePaths = [createTestRelationshipPath(1)];
      const info: SelectClassInfo = {
        ...testSelectClassInfo,
        relatedInstancePaths,
      };
      expect(SelectClassInfo.toCompressedJSON(info, classesMap)).to.deep.eq({
        ...testSelectClassInfo,
        selectClassInfo: testSelectClassInfo.selectClassInfo.id,
        relatedInstancePaths: relatedInstancePaths.map((p) => p.map((i) => RelatedClassInfo.toCompressedJSON(i, {}))),
      });
    });

  });

  describe("listFromCompressedJSON", () => {

    const classesMap = {
      [testSelectClassInfo.selectClassInfo.id]: {
        name: testSelectClassInfo.selectClassInfo.name,
        label: testSelectClassInfo.selectClassInfo.label,
      },
    };
    const compressedSelectClassInfoJson: Array<SelectClassInfoJSON<Id64String>> = [{
      selectClassInfo: testSelectClassInfo.selectClassInfo.id,
      isSelectPolymorphic: testSelectClassInfo.isSelectPolymorphic,
      pathToPrimaryClass: [],
      navigationPropertyClasses: [],
      relatedInstanceClasses: [],
      relatedPropertyPaths: [],
    }];

    it("creates valid SelectClassInfo[] from compressed JSON", () => {
      const result = SelectClassInfo.listFromCompressedJSON(compressedSelectClassInfoJson, classesMap);
      expect(result).to.deep.equal([testSelectClassInfo]);
    });

    // it("creates valid SelectClassInfo[] from serialized compressed JSON", () => {
    //   const result = SelectClassInfo.listFromCompressedJSON(JSON.stringify({ selectClassInfos: compressedSelectClassInfoJson, classesMap }));
    //   expect(result).to.deep.equal([testSelectClassInfo]);
    // });

  });

});
