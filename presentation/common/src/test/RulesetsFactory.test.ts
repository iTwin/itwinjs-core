/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  createRandomCategory, createRandomPrimitiveTypeDescription,
  createRandomId, createRandomECClassInfo,
} from "./_helpers/random";
import {
  RulesetsFactory, Rule, RuleTypes, RuleSpecificationTypes,
  Property, PropertiesField, Field, Item, PropertyValueFormat,
  PrimitiveTypeDescription, StructTypeDescription, ArrayTypeDescription,
  NestedContentField, RelatedClassInfo, NestedContentValue, RelationshipDirection, ClassInfo,
} from "../presentation-common";

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

    const createNavigationPropertyTypeDescription = (): PrimitiveTypeDescription => ({
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "navigation",
    });

    it("creates a valid ruleset for string record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: "test value" }, { MyProperty: "test display value" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for boolean `true` record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createBooleanTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: true }, { MyProperty: "True" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = TRUE`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = True`);
    });

    it("creates a valid ruleset for boolean `false` record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createBooleanTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: false }, { MyProperty: "False" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = FALSE`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = False`);
    });

    it("creates a valid ruleset for int record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createIntTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: 123 }, { MyProperty: "123" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = 123`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123`);
    });

    it("creates a valid ruleset for double record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createDoubleTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: 123.456 }, { MyProperty: "123.46" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = 123.456`, // WIP should this use display value instead?
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123.46`);
    });

    it("creates a valid ruleset for null record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: undefined }, { MyProperty: "" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty = NULL`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = NULL`);
    });

    it("creates a valid ruleset for navigation property record", () => {
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
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), "MyProperty",
        "My Property", createNavigationPropertyTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.word(), "", recordClass,
        { MyProperty: "0x16" }, { MyProperty: "test display value" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["MyClass"] },
          arePolymorphic: true,
          relatedInstances: [],
          instanceFilter: `this.MyProperty.Id = "0x16"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for one-step forward related nested content record", () => {
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
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "MyProperty",
        },
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), faker.random.word(),
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
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
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          arePolymorphic: true,
          relatedInstances: [{
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass" },
            requiredDirection: RelationshipDirection.Forward,
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.MyProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for one-step backward related nested content record", () => {
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
        sourceClassInfo: recordClass,
        targetClassInfo: propertyClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "RelatedProperty",
        },
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), faker.random.word(),
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
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
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          arePolymorphic: true,
          relatedInstances: [{
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass" },
            requiredDirection: RelationshipDirection.Backward,
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.RelatedProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for one-step forward related property record", () => {
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
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "RelatedProperty",
        },
        relatedClassPath: relationshipPath,
      };
      const field = new PropertiesField(createRandomCategory(), "RelatedProperty",
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.words(), "", recordClass,
        { RelatedProperty: "test value" }, { RelatedProperty: "test display value" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          arePolymorphic: true,
          relatedInstances: [{
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass" },
            requiredDirection: RelationshipDirection.Forward,
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.RelatedProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for one-step backward related property record", () => {
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
        sourceClassInfo: recordClass,
        targetClassInfo: propertyClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: true,
        isPolymorphicRelationship: true,
      }];
      const property: Property = {
        property: {
          classInfo: propertyClass,
          type: "string",
          name: "RelatedProperty",
        },
        relatedClassPath: relationshipPath,
      };
      const field = new PropertiesField(createRandomCategory(), "RelatedProperty",
        "Related Property", createStringTypeDescription(), true, 1, [property]);
      const record = new Item([], faker.random.words(), "", recordClass,
        { RelatedProperty: "test value" }, { RelatedProperty: "test display value" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          arePolymorphic: true,
          relatedInstances: [{
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass" },
            requiredDirection: RelationshipDirection.Backward,
            isRequired: true,
            alias: "related_0",
          }],
          instanceFilter: `related_0.RelatedProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset when related property record is based on multiple properties", () => {
      // not sure if this is really a valid case, we can still handle it
      const recordClass: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:PrimaryClass",
        label: "Primary Class",
      };
      const propertyClass1: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:RelatedClass1",
        label: "Related Class 1",
      };
      const relationshipPath1: RelatedClassInfo[] = [{
        sourceClassInfo: propertyClass1,
        targetClassInfo: recordClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: false,
        isPolymorphicRelationship: true,
      }];
      const property1: Property = {
        property: {
          classInfo: propertyClass1,
          type: "string",
          name: "RelatedProperty",
        },
        relatedClassPath: relationshipPath1,
      };
      const propertyClass2: ClassInfo = {
        id: createRandomId(),
        name: "MySchema:RelatedClass2",
        label: "Related Class 2",
      };
      const relationshipPath2: RelatedClassInfo[] = [{
        sourceClassInfo: propertyClass2,
        targetClassInfo: recordClass,
        relationshipInfo: {
          id: createRandomId(),
          name: "MySchema:MyRelationship",
          label: "My Relationship",
        },
        isForwardRelationship: false,
        isPolymorphicRelationship: true,
      }];
      const property2: Property = {
        property: {
          classInfo: propertyClass2,
          type: "string",
          name: "RelatedProperty",
        },
        relatedClassPath: relationshipPath2,
      };
      const field = new PropertiesField(createRandomCategory(), "RelatedProperty",
        "Related Property", createStringTypeDescription(), true, 1, [property1, property2]);
      const record = new Item([], faker.random.words(), "", recordClass,
        { RelatedProperty: "test value" }, { RelatedProperty: "test display value" }, []);
      const result = factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [{
        ruleType: RuleTypes.Content,
        specifications: [{
          specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
          classes: { schemaName: "MySchema", classNames: ["PrimaryClass"] },
          arePolymorphic: true,
          relatedInstances: [{
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass1" },
            requiredDirection: RelationshipDirection.Forward,
            isRequired: true,
            alias: "related_0",
          }, {
            relationship: { schemaName: "MySchema", className: "MyRelationship" },
            class: { schemaName: "MySchema", className: "RelatedClass2" },
            requiredDirection: RelationshipDirection.Forward,
            isRequired: true,
            alias: "related_1",
          }],
          instanceFilter: `related_0.RelatedProperty = "test value" OR related_1.RelatedProperty = "test value"`,
        }],
      }];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class 1].[Related Property] = test display value OR [Related Class 2].[Related Property] = test display value`);
    });

    describe("invalid conditions", () => {

      it("throws when record contains invalid value", () => {
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
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), "MyProperty",
          faker.random.word(), createBooleanTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "", recordClass,
          { MyProperty: [] }, { MyProperty: "" }, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when properties field contains no properties", () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:MyClass",
          label: "My Class",
        };
        const field = new PropertiesField(createRandomCategory(), "MyProperty",
          faker.random.word(), createBooleanTypeDescription(), true, 1, []);
        const record = new Item([], faker.random.word(), "", recordClass,
          { MyProperty: "test value" }, { MyProperty: "test display value" }, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when nested content record doesn't have path to primary class", () => {
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
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), [], [field]);
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when nested content record contains invalid value", () => {
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
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
        field.rebuildParentship(parentField);
        const values = {
          [parentField.name]: "invalid",
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const record = new Item([], faker.random.words(), "", recordClass, values, displayValues, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

    });

    describe("unsupported conditions", () => {

      it("throws when field is not a properties field", () => {
        const field = new Field(createRandomCategory(), faker.random.word(),
          faker.random.word(), createRandomPrimitiveTypeDescription(), true, 1);
        const record = new Item([], faker.random.word(), "", undefined, {}, {}, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when properties field is of point2d type", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: PrimitiveTypeDescription = {
          valueFormat: PropertyValueFormat.Primitive,
          typeName: "point2d",
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), typeDescription, true, 1, [property]);
        const values = {
          [field.name]: { x: 1, y: 2 },
        };
        const displayValues = {
          [field.name]: { x: "one", y: "two" },
        };
        const record = new Item([], faker.random.word(), "", undefined, values, displayValues, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when properties field is of point3d type", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: PrimitiveTypeDescription = {
          valueFormat: PropertyValueFormat.Primitive,
          typeName: "point3d",
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), typeDescription, true, 1, [property]);
        const values = {
          [field.name]: { x: 1, y: 2, z: 3 },
        };
        const displayValues = {
          [field.name]: { x: "one", y: "two", z: "three" },
        };
        const record = new Item([], faker.random.word(), "", undefined, values, displayValues, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when properties field is of array type", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createRandomPrimitiveTypeDescription(),
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), typeDescription, true, 1, [property]);
        const values = {
          [field.name]: ["some value 1", "some value 2"],
        };
        const displayValues = {
          [field.name]: ["some display value 1", "some display value 2"],
        };
        const record = new Item([], faker.random.word(), "", undefined, values, displayValues, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when properties field is of struct type", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createRandomPrimitiveTypeDescription(),
          }],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when record is merged", () => {
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
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), "MyProperty",
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "", undefined,
          { MyProperty: "test value" }, { MyProperty: "test value" }, ["MyProperty"]);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when record is based on different classes", () => {
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
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), "MyProperty",
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.word(), "",
          undefined /* this `undefined` means that record is based on multiple different classes */,
          { MyProperty: "test value" }, { MyProperty: "test display value" }, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when related property is contained inside nested content record", () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const nestedContentClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:NestedContentClass",
          label: "Nested Content Class",
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const propertyRelationshipPath: RelatedClassInfo[] = [{
          sourceClassInfo: propertyClass,
          targetClassInfo: nestedContentClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship1",
            label: "My Relationship 1",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: propertyRelationshipPath,
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const nestedContentRelationshipPath: RelatedClassInfo[] = [{
          sourceClassInfo: nestedContentClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship2",
            label: "My Relationship 2",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }];
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), nestedContentClass, nestedContentRelationshipPath, [field]);
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when property is related through more than one relationship", () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const intermediateClass: ClassInfo = {
          id: createRandomId(),
          name: faker.random.word(),
          label: faker.random.word(),
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
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
        }, {
          sourceClassInfo: intermediateClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship 2",
            label: "My Relationship 2",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: relationshipPath,
        };
        const field = new PropertiesField(createRandomCategory(), "MyProperty",
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const record = new Item([], faker.random.words(), "", recordClass,
          { MyProperty: "test value" }, { MyProperty: "test display value" }, []);
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when nested content record's path to primary path is longer than 1 step", () => {
        const recordClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const intermediateClass: ClassInfo = {
          id: createRandomId(),
          name: faker.random.word(),
          label: faker.random.word(),
        };
        const propertyClass: ClassInfo = {
          id: createRandomId(),
          name: "MySchema:RelatedClass",
          label: "Related Class",
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
        }, {
          sourceClassInfo: intermediateClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: createRandomId(),
            name: "MySchema:MyRelationship 2",
            label: "My Relationship 2",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when nested content record contains more than one nested record", () => {
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
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

      it("throws when nested content record is merged", () => {
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
        }];
        const property: Property = {
          property: {
            classInfo: propertyClass,
            type: "string",
            name: "MyProperty",
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.word(), createStringTypeDescription(), true, 1, [property]);
        const parentField = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), relationshipPath, [field]);
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
        expect(() => factory.createSimilarInstancesRuleset(field, record)).to.throw();
      });

    });

  });

});
