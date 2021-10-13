/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import {
  ArrayTypeDescription, ClassInfo, ContentSpecificationTypes, Field, Item, NestedContentField, NestedContentValue, PrimitiveTypeDescription,
  PropertiesField, Property, PropertyValueFormat, RelatedClassInfo, RelationshipDirection, Rule, RulesetsFactory, RuleTypes, StructTypeDescription,
} from "../presentation-common";
import { createTestCategoryDescription } from "./_helpers/Content";
import { createRandomECClassInfo, createRandomId } from "./_helpers/random";

describe("RulesetsFactory", () => {

  let factory: RulesetsFactory;

  beforeEach(() => {
    factory = new RulesetsFactory();
  });

  describe("createSimilarInstancesRuleset", () => {

    const createStringTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "string",
    });

    const createBooleanTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "boolean",
    });

    const createIntTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "int",
    });

    const createDoubleTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "double",
    });

    const createDateTimeTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "dateTime",
    });

    const createPoint2dTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "point2d",
    });

    const createPoint3dTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "point3d",
    });

    const createNavigationPropertyTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "navigation",
    });

    it("creates a valid ruleset for string record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: `test value with double "quotes"` }, { ["MyProperty"]: "test display value" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = "test value with double ""quotes"""`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for boolean `true` record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "boolean",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createBooleanTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: true }, { ["MyProperty"]: "True" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = TRUE`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = True`);
    });

    it("creates a valid ruleset for boolean `false` record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "boolean",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createBooleanTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: false }, { ["MyProperty"]: "False" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = FALSE`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = False`);
    });

    it("creates a valid ruleset for int record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "int",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createIntTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: 123 }, { ["MyProperty"]: "123" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = 123`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123`);
    });

    it("creates a valid ruleset for double record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "double",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createDoubleTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: 123.456 }, { ["MyProperty"]: "123.46" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDoubles(this.MyProperty, 123.456) = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123.46`);
    });

    it("creates a valid ruleset for datetime record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "dateTime",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createDateTimeTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: "2007-07-13T07:18:07.000" }, { ["MyProperty"]: "633199078870000000" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDateTimes(this.MyProperty, "2007-07-13T07:18:07.000") = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 633199078870000000`);
    });

    it("creates a valid ruleset for point2d record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "point2d",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createPoint2dTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: { x: 1, y: 2 } }, { ["MyProperty"]: "1, 2" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2`);
    });

    it("creates a valid ruleset for point2d record with (0,0) coordinates", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "point2d",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createPoint2dTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: { x: 0, y: 0 } }, { ["MyProperty"]: "0, 0" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDoubles(this.MyProperty.x, 0) = 0 AND CompareDoubles(this.MyProperty.y, 0) = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 0, 0`);
    });

    it("creates a valid ruleset for point3d record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "point3d",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createPoint3dTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: { x: 1, y: 2, z: 3 } }, { ["MyProperty"]: "1, 2, 3" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0 AND CompareDoubles(this.MyProperty.z, 3) = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2, 3`);
    });

    it("creates a valid ruleset for point3d record when z value is 0", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "point3d",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createPoint3dTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: { x: 1, y: 2, z: 0 } }, { ["MyProperty"]: "1, 2, 0" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0 AND CompareDoubles(this.MyProperty.z, 0) = 0`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2, 0`);
    });

    it("creates a valid ruleset for null record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: undefined }, { ["MyProperty"]: "" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = NULL`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = NULL`);
    });

    it("creates a valid ruleset for navigation property record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "long",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createNavigationPropertyTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: { className: "MySchema:MyClass", id: "0x16" } }, { ["MyProperty"]: "test display value" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty.Id = ${parseInt("0x16", 16)}`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for one-step forward related nested content record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:PrimaryClass",
        label: "Primary Class",
      };
      const propertyClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:RelatedClass",
        label: "Related Class",
      };
      const relationshipPath: RelatedClassInfo[] = [{
        sourceClassInfo: propertyClass,
        targetClassInfo: recordClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: false,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
        faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
      field.rebuildParentship(parentField);
      const values = {
        [parentField.name]: [{
          primaryKeys: [],
          values: {
            [field.name]: "test value",
          },
          displayValues: {
            [field.name]: "test display value",
          },
          mergedFieldNames: [],
        }] as NestedContentValue[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [{
            relationshipPath: [{
              relationship: { schemaName: "MySchema", className: "MyRelationship" },
              direction: RelationshipDirection.Forward,
              targetClass: { schemaName: "MySchema", className: "RelatedClass" },
            }],
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.MyProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for one-step backward related nested content record", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:PrimaryClass",
        label: "Primary Class",
      };
      const propertyClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:RelatedClass",
        label: "Related Class",
      };
      const relationshipPath: RelatedClassInfo[] = [{
        sourceClassInfo: propertyClass,
        targetClassInfo: recordClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "RelatedProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
        faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
      field.rebuildParentship(parentField);
      const values = {
        [parentField.name]: [{
          primaryKeys: [],
          values: {
            [field.name]: "test value",
          },
          displayValues: {
            [field.name]: "test display value",
          },
          mergedFieldNames: [],
        }] as NestedContentValue[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [{
            relationshipPath: [{
              relationship: { schemaName: "MySchema", className: "MyRelationship" },
              direction: RelationshipDirection.Backward,
              targetClass: { schemaName: "MySchema", className: "RelatedClass" },
            }],
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.RelatedProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for multi-step related nested content record", async () => {
      const selectClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:SelectClass",
        label: "Select Class",
      };
      const intermediateClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:SomeClass",
        label: "Some Class",
      };
      const propertyClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:PropertyClass",
        label: "Property Class",
      };
      const relationshipPath: RelatedClassInfo[] = [{
        sourceClassInfo: propertyClass,
        targetClassInfo: intermediateClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship1",
          label: "My Relationship 1",
        },
        isForwardRelationship: false,
        isPolymorphicRelationship: true,
        isPolymorphicTargetClass: true,
      }, {
        sourceClassInfo: intermediateClass,
        targetClassInfo: selectClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship2",
          label: "My Relationship 2",
        },
        isForwardRelationship: true,
        isPolymorphicTargetClass: true,
        isPolymorphicRelationship: true,
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
        faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
      field.rebuildParentship(parentField);
      const values = {
        [parentField.name]: [{
          primaryKeys: [],
          values: {
            [field.name]: "test value",
          },
          displayValues: {
            [field.name]: "test display value",
          },
          mergedFieldNames: [],
        }] as NestedContentValue[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const record = new Item([], faker.random.words(), "", selectClass, values, displayValues, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["SelectClass"] },
          handleInstancesPolymorphically: true,
          relatedInstances: [{
            relationshipPath: [{
              relationship: { schemaName: "MySchema", className: "MyRelationship2" },
              direction: RelationshipDirection.Backward,
              targetClass: { schemaName: "MySchema", className: "SomeClass" },
            }, {
              relationship: { schemaName: "MySchema", className: "MyRelationship1" },
              direction: RelationshipDirection.Forward,
              targetClass: { schemaName: "MySchema", className: "PropertyClass" },
            }],
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.MyProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Property Class].[Related Property] = test display value`);
    });

    it("uses supplied `computeDisplayValue` callback to calculate display value for description", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: "test value" }, { ["MyProperty"]: "test display value" }, []);
      const callback = sinon.fake(() => "TEST");
      const result = await factory.createSimilarInstancesRuleset(field, record, callback);
      expect(callback).to.be.calledOnceWithExactly(field.type.typeName, "test value", "test display value");
      expect(result.description).to.eq(`[My Class].[My Property] = TEST`);
    });

    it("uses record display value as display value for description if `computeDisplayValue` callback is not supplied", async () => {
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const property: Property = {
        property: {
          classInfo: recordClass,
          type: "string",
          name: "MyProperty",
        },
      };
      const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { ["MyProperty"]: "test value" }, { ["MyProperty"]: "test display value" }, []);
      const result = await factory.createSimilarInstancesRuleset(field, record);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    describe("invalid conditions", () => {
      for (const invalidValue of [[], {}]) {
        it(`throws when record value is '${invalidValue}'`, async () => {
          const recordClass: ClassInfo = {
            id: createRandomId(),
            name: "MySchema:MyClass",
            label: "My Class",
          };
          const property: Property = {
            property: {
              classInfo: recordClass,
              type: "boolean",
              name: "MyProperty",
            },
          };
          const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
            faker.random.word(), createBooleanTypeDescription(), true, 1, [property]);
          const record = new Item([], faker.random.word(), "", recordClass,
            { ["MyProperty"]: invalidValue }, { ["MyProperty"]: "" }, []);
          await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can only create 'similar instances' ruleset for primitive values");
        });
      }

      it("throws when properties field contains no properties", async () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:MyClass",
          label: "My Class",
        };
        const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
          faker.random.word(), createBooleanTypeDescription(), true, 1, []);
        const record = new Item([], faker.random.word(), "", recordClass,
          { ["MyProperty"]: "test value" }, { ["MyProperty"]: "test display value" }, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Invalid properties' field with no properties");
      });

      it("throws when nested content record contains invalid value", async () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [{
          sourceClassInfo: propertyClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship",
            label: "My Relationship",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
          faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
        field.rebuildParentship(parentField);
        const values = {
          [parentField.name]: "invalid",
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Invalid record value");
      });

      it("throws when point2d record has invalid value", async () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:MyClass",
          label: "My Class",
        };
        const property: Property = {
          property: {
            classInfo: recordClass,
            type: "point2d",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
          "My Property", createPoint2dTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "", recordClass,
          { ["MyProperty"]: "should be {x,y} object" }, { ["MyProperty"]: "1, 2" }, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Expecting point values to be supplied as objects");
      });

    });

    describe("unsupported conditions", () => {

      it("throws when field is not a properties field", async () => {
        const field = new Field(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1);
        const record = new Item([], faker.random.word(), "", undefined, {}, {}, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can only create 'similar instances' ruleset for properties-based records");
      });

      it("throws when properties field is of array type", async () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createStringTypeDescription(),
        };
        const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), typeDescription, true, 1, [property]);
        const values = {
          [field.name]: ["some value 1", "some value 2"],
        };
        const displayValues = {
          [field.name]: ["some display value 1", "some display value 2"],
        };
        const record = new Item([], faker.random.word(), "", undefined, values, displayValues, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can only create 'similar instances' ruleset for primitive properties");
      });

      it("throws when properties field is of struct type", async () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createStringTypeDescription(),
          }],
        };
        const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), typeDescription, true, 1, [property]);
        const values = {
          [field.name]: {
            [typeDescription.members[0].name]: "some value",
          },
        };
        const displayValues = {
          [field.name]: {
            [typeDescription.members[0].name]: "some display value",
          },
        };
        const record = new Item([], faker.random.word(), "", undefined, values, displayValues, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can only create 'similar instances' ruleset for primitive properties");
      });

      it("throws when record is merged", async () => {
        const property: Property = {
          property: {
            classInfo: {
              id: createRandomId(),
              name: "MySchema:MyClass",
              label: "My Class",
            },
            type: "string",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "", undefined,
          { ["MyProperty"]: "test value" }, { ["MyProperty"]: "test value" }, ["MyProperty"]);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can't create 'similar instances' ruleset for merged values");
      });

      it("throws when record is based on different classes", async () => {
        const property: Property = {
          property: {
            classInfo: {
              id: createRandomId(),
              name: "MySchema:MyClass",
              label: "My Class",
            },
            type: "string",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), "MyProperty",
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "",
          undefined /* this `undefined` means that record is based on multiple different classes */,
          { ["MyProperty"]: "test value" }, { ["MyProperty"]: "test display value" }, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can't create 'similar instances' for records based on multiple different ECClass instances");
      });

      it("throws when nested content record contains more than one nested record", async () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [{
          sourceClassInfo: propertyClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship",
            label: "My Relationship",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
          faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
        field.rebuildParentship(parentField);
        const values = {
          [parentField.name]: [{
            primaryKeys: [],
            values: {
              [field.name]: "test value 1",
            },
            displayValues: {
              [field.name]: "test display value 1",
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [],
            values: {
              [field.name]: "test value 2",
            },
            displayValues: {
              [field.name]: "test display value 2",
            },
            mergedFieldNames: [],
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejected;
      });

      it("throws when nested content record is merged", async () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [{
          sourceClassInfo: propertyClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship",
            label: "My Relationship",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
        };
        const field = new PropertiesField(createTestCategoryDescription(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createTestCategoryDescription(), faker.random.word(),
          faker.random.words(), createStringTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field], undefined, faker.random.boolean());
        field.rebuildParentship(parentField);
        const values = {
          [parentField.name]: [{
            primaryKeys: [],
            values: {
              [field.name]: "test value",
            },
            displayValues: {
              [field.name]: "test display value",
            },
            mergedFieldNames: [field.name],
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Can't create 'similar instances' ruleset for merged values");
      });

    });

  });

});
