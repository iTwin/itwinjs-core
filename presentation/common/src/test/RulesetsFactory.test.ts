/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import {
  ArrayTypeDescription,
  ClassInfo,
  ContentSpecificationTypes,
  PrimitiveTypeDescription,
  Property,
  PropertyValueFormat,
  RelatedClassInfo,
  RelationshipDirection,
  Rule,
  RulesetsFactory,
  RuleTypes,
  StructTypeDescription,
} from "../presentation-common.js";
import { createTestPropertyInfo } from "./_helpers/index.js";
import { createTestContentItem, createTestNestedContentField, createTestPropertiesContentField, createTestSimpleContentField } from "./_helpers/Content.js";

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
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createStringTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: `test value with double "quotes"` },
        displayValues: { ["MyProperty"]: "test display value" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty = "test value with double ""quotes"""`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for boolean `true` record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createBooleanTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: true },
        displayValues: { ["MyProperty"]: "True" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty = TRUE`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = True`);
    });

    it("creates a valid ruleset for boolean `false` record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createBooleanTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: false },
        displayValues: { ["MyProperty"]: "False" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty = FALSE`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = False`);
    });

    it("creates a valid ruleset for int record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createIntTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: 123 },
        displayValues: { ["MyProperty"]: "123" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty = 123`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123`);
    });

    it("creates a valid ruleset for double record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createDoubleTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: 123.456 },
        displayValues: { ["MyProperty"]: "123.46" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDoubles(this.MyProperty, 123.456) = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 123.46`);
    });

    it("creates a valid ruleset for datetime record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createDateTimeTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: "2007-07-13T07:18:07.000" },
        displayValues: { ["MyProperty"]: "633199078870000000" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDateTimes(this.MyProperty, "2007-07-13T07:18:07.000") = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 633199078870000000`);
    });

    it("creates a valid ruleset for point2d record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createPoint2dTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: { x: 1, y: 2 } },
        displayValues: { ["MyProperty"]: "1, 2" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2`);
    });

    it("creates a valid ruleset for point2d record with (0,0) coordinates", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createPoint2dTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: { x: 0, y: 0 } },
        displayValues: { ["MyProperty"]: "0, 0" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDoubles(this.MyProperty.x, 0) = 0 AND CompareDoubles(this.MyProperty.y, 0) = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 0, 0`);
    });

    it("creates a valid ruleset for point3d record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createPoint3dTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: { x: 1, y: 2, z: 3 } },
        displayValues: { ["MyProperty"]: "1, 2, 3" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0 AND CompareDoubles(this.MyProperty.z, 3) = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2, 3`);
    });

    it("creates a valid ruleset for point3d record when z value is 0", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createPoint3dTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: { x: 1, y: 2, z: 0 } },
        displayValues: { ["MyProperty"]: "1, 2, 0" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `CompareDoubles(this.MyProperty.x, 1) = 0 AND CompareDoubles(this.MyProperty.y, 2) = 0 AND CompareDoubles(this.MyProperty.z, 0) = 0`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = 1, 2, 0`);
    });

    it("creates a valid ruleset for null record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createStringTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: undefined },
        displayValues: { ["MyProperty"]: "" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty = NULL`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = NULL`);
    });

    it("creates a valid ruleset for navigation property record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
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
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createNavigationPropertyTypeDescription(),
        properties: [property],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: { className: "MySchema:MyClass", id: "0x16" } },
        displayValues: { ["MyProperty"]: "test display value" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["MyClass"], arePolymorphic: true },
              relatedInstances: [],
              instanceFilter: `this.MyProperty.Id = ${parseInt("0x16", 16)}`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    it("creates a valid ruleset for one-step forward related nested content record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:PrimaryClass",
        label: "Primary Class",
      };
      const propertyClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:RelatedClass",
        label: "Related Class",
      };
      const relationshipPath: RelatedClassInfo[] = [
        {
          sourceClassInfo: propertyClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: "0x123",
            name: "MySchema:MyRelationship",
            label: "My Relationship",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];
      const field = createTestPropertiesContentField({
        name: "RelatedProperty",
        label: "Related Property",
        type: createStringTypeDescription(),
        properties: [
          {
            property: {
              classInfo: propertyClass,
              type: "string",
              name: "MyProperty",
            },
          },
        ],
      });
      const parentField = createTestNestedContentField({
        pathToPrimaryClass: relationshipPath,
        nestedFields: [field],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: {
          [parentField.name]: [
            {
              primaryKeys: [],
              values: {
                [field.name]: "test value",
              },
              displayValues: {
                [field.name]: "test display value",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [field.name]: undefined,
        },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["PrimaryClass"], arePolymorphic: true },
              relatedInstances: [
                {
                  relationshipPath: [
                    {
                      relationship: { schemaName: "MySchema", className: "MyRelationship" },
                      direction: RelationshipDirection.Forward,
                      targetClass: { schemaName: "MySchema", className: "RelatedClass" },
                    },
                  ],
                  isRequired: true,
                  alias: "related_0",
                },
              ],
              instanceFilter: `related_0.MyProperty = "test value"`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for one-step backward related nested content record", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:PrimaryClass",
        label: "Primary Class",
      };
      const propertyClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:RelatedClass",
        label: "Related Class",
      };
      const relationshipPath: RelatedClassInfo[] = [
        {
          sourceClassInfo: propertyClass,
          targetClassInfo: recordClass,
          relationshipInfo: {
            id: "0x123",
            name: "MySchema:MyRelationship",
            label: "My Relationship",
          },
          isForwardRelationship: true,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
      ];

      const field = createTestPropertiesContentField({
        name: "RelatedProperty",
        label: "Related Property",
        type: createStringTypeDescription(),
        properties: [
          {
            property: {
              classInfo: propertyClass,
              type: "string",
              name: "RelatedProperty",
            },
          },
        ],
      });
      const parentField = createTestNestedContentField({
        pathToPrimaryClass: relationshipPath,
        nestedFields: [field],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: {
          [parentField.name]: [
            {
              primaryKeys: [],
              values: {
                [field.name]: "test value",
              },
              displayValues: {
                [field.name]: "test display value",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [field.name]: undefined,
        },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["PrimaryClass"], arePolymorphic: true },
              relatedInstances: [
                {
                  relationshipPath: [
                    {
                      relationship: { schemaName: "MySchema", className: "MyRelationship" },
                      direction: RelationshipDirection.Backward,
                      targetClass: { schemaName: "MySchema", className: "RelatedClass" },
                    },
                  ],
                  isRequired: true,
                  alias: "related_0",
                },
              ],
              instanceFilter: `related_0.RelatedProperty = "test value"`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Related Class].[Related Property] = test display value`);
    });

    it("creates a valid ruleset for multi-step related nested content record", async () => {
      const selectClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:SelectClass",
        label: "Select Class",
      };
      const intermediateClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:SomeClass",
        label: "Some Class",
      };
      const propertyClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:PropertyClass",
        label: "Property Class",
      };
      const relationshipPath: RelatedClassInfo[] = [
        {
          sourceClassInfo: propertyClass,
          targetClassInfo: intermediateClass,
          relationshipInfo: {
            id: "0x123",
            name: "MySchema:MyRelationship1",
            label: "My Relationship 1",
          },
          isForwardRelationship: false,
          isPolymorphicRelationship: true,
          isPolymorphicTargetClass: true,
        },
        {
          sourceClassInfo: intermediateClass,
          targetClassInfo: selectClass,
          relationshipInfo: {
            id: "0x123",
            name: "MySchema:MyRelationship2",
            label: "My Relationship 2",
          },
          isForwardRelationship: true,
          isPolymorphicTargetClass: true,
          isPolymorphicRelationship: true,
        },
      ];

      const field = createTestPropertiesContentField({
        name: "RelatedProperty",
        label: "Related Property",
        type: createStringTypeDescription(),
        properties: [
          {
            property: {
              classInfo: propertyClass,
              type: "string",
              name: "MyProperty",
            },
          },
        ],
      });
      const parentField = createTestNestedContentField({
        pathToPrimaryClass: relationshipPath,
        nestedFields: [field],
      });
      const record = createTestContentItem({
        classInfo: selectClass,
        values: {
          [parentField.name]: [
            {
              primaryKeys: [],
              values: {
                [field.name]: "test value",
              },
              displayValues: {
                [field.name]: "test display value",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {
          [field.name]: undefined,
        },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      const expectedRules: Rule[] = [
        {
          ruleType: RuleTypes.Content,
          specifications: [
            {
              specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
              classes: { schemaName: "MySchema", classNames: ["SelectClass"], arePolymorphic: true },
              relatedInstances: [
                {
                  relationshipPath: [
                    {
                      relationship: { schemaName: "MySchema", className: "MyRelationship2" },
                      direction: RelationshipDirection.Backward,
                      targetClass: { schemaName: "MySchema", className: "SomeClass" },
                    },
                    {
                      relationship: { schemaName: "MySchema", className: "MyRelationship1" },
                      direction: RelationshipDirection.Forward,
                      targetClass: { schemaName: "MySchema", className: "PropertyClass" },
                    },
                  ],
                  isRequired: true,
                  alias: "related_0",
                },
              ],
              instanceFilter: `related_0.MyProperty = "test value"`,
            },
          ],
        },
      ];
      expect(result.ruleset.rules).to.deep.eq(expectedRules);
      expect(result.description).to.eq(`[Property Class].[Related Property] = test display value`);
    });

    it("uses supplied `computeDisplayValue` callback to calculate display value for description", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createStringTypeDescription(),
        properties: [
          {
            property: {
              classInfo: recordClass,
              type: "string",
              name: "MyProperty",
            },
          },
        ],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: "test value" },
        displayValues: { ["MyProperty"]: "test display value" },
      });
      const callback = sinon.fake(async () => "TEST");
      const result = await factory.createSimilarInstancesRuleset(field, record, callback);
      expect(callback).to.be.calledOnceWithExactly(field.type.typeName, "test value", "test display value");
      expect(result.description).to.eq(`[My Class].[My Property] = TEST`);
    });

    it("uses record display value as display value for description if `computeDisplayValue` callback is not supplied", async () => {
      const recordClass: ClassInfo = {
        id: "0x123",
        name: "MySchema:MyClass",
        label: "My Class",
      };
      const field = createTestPropertiesContentField({
        name: "MyProperty",
        label: "My Property",
        type: createStringTypeDescription(),
        properties: [
          {
            property: {
              classInfo: recordClass,
              type: "string",
              name: "MyProperty",
            },
          },
        ],
      });
      const record = createTestContentItem({
        classInfo: recordClass,
        values: { ["MyProperty"]: "test value" },
        displayValues: { ["MyProperty"]: "test display value" },
      });
      const result = await factory.createSimilarInstancesRuleset(field, record);
      expect(result.description).to.eq(`[My Class].[My Property] = test display value`);
    });

    describe("invalid conditions", () => {
      for (const invalidValue of [[], {}]) {
        it(`throws when record value is '${JSON.stringify(invalidValue)}'`, async () => {
          const recordClass: ClassInfo = {
            id: "0x123",
            name: "MySchema:MyClass",
            label: "My Class",
          };
          const field = createTestPropertiesContentField({
            name: "MyProperty",
            label: "My Property",
            type: createStringTypeDescription(),
            properties: [
              {
                property: {
                  classInfo: recordClass,
                  type: "string",
                  name: "MyProperty",
                },
              },
            ],
          });
          const record = createTestContentItem({
            classInfo: recordClass,
            values: { ["MyProperty"]: invalidValue },
            displayValues: { ["MyProperty"]: "" },
          });
          await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
            "Can only create 'similar instances' ruleset for primitive values",
          );
        });
      }

      it("throws when properties field contains no properties", async () => {
        const recordClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:MyClass",
          label: "My Class",
        };
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: createStringTypeDescription(),
          properties: [],
        });
        const record = createTestContentItem({
          classInfo: recordClass,
          values: { ["MyProperty"]: "test value" },
          displayValues: { ["MyProperty"]: "test display value" },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Invalid properties' field with no properties");
      });

      it("throws when nested content record contains invalid value", async () => {
        const recordClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [
          {
            sourceClassInfo: propertyClass,
            targetClassInfo: recordClass,
            relationshipInfo: {
              id: "0x123",
              name: "MySchema:MyRelationship",
              label: "My Relationship",
            },
            isForwardRelationship: false,
            isPolymorphicRelationship: true,
            isPolymorphicTargetClass: true,
          },
        ];
        const field = createTestPropertiesContentField({
          type: createStringTypeDescription(),
          properties: [
            {
              property: {
                classInfo: propertyClass,
                type: "string",
                name: "MyProperty",
              },
            },
          ],
        });
        const parentField = createTestNestedContentField({
          pathToPrimaryClass: relationshipPath,
          nestedFields: [field],
        });
        const record = createTestContentItem({
          classInfo: recordClass,
          values: {
            [parentField.name]: "invalid",
          },
          displayValues: {
            [field.name]: undefined,
          },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Invalid record value");
      });

      it("throws when point2d record has invalid value", async () => {
        const recordClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:MyClass",
          label: "My Class",
        };
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: createPoint2dTypeDescription(),
          properties: [
            {
              property: {
                classInfo: recordClass,
                type: "point2d",
                name: "MyProperty",
              },
            },
          ],
        });
        const record = createTestContentItem({
          classInfo: recordClass,
          values: { ["MyProperty"]: "should be {x,y} object" },
          displayValues: { ["MyProperty"]: "1, 2" },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith("Expecting point values to be supplied as objects");
      });
    });

    describe("unsupported conditions", () => {
      it("throws when field is not a properties field", async () => {
        const field = createTestSimpleContentField({
          name: "MyProperty",
          label: "My Property",
          type: createPoint2dTypeDescription(),
        });
        const record = createTestContentItem({
          values: { ["MyProperty"]: undefined },
          displayValues: { ["MyProperty"]: "" },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can only create 'similar instances' ruleset for properties-based records",
        );
      });

      it("throws when properties field is of array type", async () => {
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: "string[]",
            memberType: createStringTypeDescription(),
          } satisfies ArrayTypeDescription,
          properties: [
            {
              property: createTestPropertyInfo(),
            },
          ],
        });
        const record = createTestContentItem({
          values: { ["MyProperty"]: ["some value 1", "some value 2"] },
          displayValues: { ["MyProperty"]: ["some display value 1", "some display value 2"] },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can only create 'similar instances' ruleset for primitive properties",
        );
      });

      it("throws when properties field is of struct type", async () => {
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "MyStruct",
          members: [
            {
              name: "StructMemberX",
              label: "X",
              type: createStringTypeDescription(),
            },
          ],
        };
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: typeDescription,
          properties: [
            {
              property: createTestPropertyInfo(),
            },
          ],
        });
        const record = createTestContentItem({
          values: {
            ["MyProperty"]: {
              [typeDescription.members[0].name]: "some value",
            },
          },
          displayValues: {
            ["MyProperty"]: {
              [typeDescription.members[0].name]: "some value",
            },
          },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can only create 'similar instances' ruleset for primitive properties",
        );
      });

      it("throws when record is merged", async () => {
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: createStringTypeDescription(),
          properties: [
            {
              property: createTestPropertyInfo(),
            },
          ],
        });
        const record = createTestContentItem({
          values: {
            ["MyProperty"]: "test value",
          },
          displayValues: {
            ["MyProperty"]: "test display value",
          },
          mergedFieldNames: ["MyProperty"],
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can't create 'similar instances' ruleset for merged values",
        );
      });

      it("throws when record is based on different classes", async () => {
        const field = createTestPropertiesContentField({
          name: "MyProperty",
          label: "My Property",
          type: createStringTypeDescription(),
          properties: [
            {
              property: createTestPropertyInfo(),
            },
          ],
        });
        const record = createTestContentItem({
          classInfo: undefined /* this `undefined` means that record is based on multiple different classes */,
          values: {
            ["MyProperty"]: "test value",
          },
          displayValues: {
            ["MyProperty"]: "test display value",
          },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can't create 'similar instances' for records based on multiple different ECClass instances",
        );
      });

      it("throws when nested content record contains more than one nested record", async () => {
        const recordClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [
          {
            sourceClassInfo: propertyClass,
            targetClassInfo: recordClass,
            relationshipInfo: {
              id: "0x123",
              name: "MySchema:MyRelationship",
              label: "My Relationship",
            },
            isForwardRelationship: false,
            isPolymorphicRelationship: true,
            isPolymorphicTargetClass: true,
          },
        ];
        const field = createTestPropertiesContentField({
          type: createStringTypeDescription(),
          properties: [
            {
              property: {
                classInfo: propertyClass,
                type: "string",
                name: "MyProperty",
              },
            },
          ],
        });
        const parentField = createTestNestedContentField({
          pathToPrimaryClass: relationshipPath,
          nestedFields: [field],
        });
        const record = createTestContentItem({
          classInfo: recordClass,
          values: {
            [parentField.name]: [
              {
                primaryKeys: [],
                values: {
                  [field.name]: "test value 1",
                },
                displayValues: {
                  [field.name]: "test display value 1",
                },
                mergedFieldNames: [],
              },
              {
                primaryKeys: [],
                values: {
                  [field.name]: "test value 2",
                },
                displayValues: {
                  [field.name]: "test display value 2",
                },
                mergedFieldNames: [],
              },
            ],
          },
          displayValues: {
            [field.name]: undefined,
          },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejected;
      });

      it("throws when nested content record is merged", async () => {
        const recordClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:PrimaryClass",
          label: "Primary Class",
        };
        const propertyClass: ClassInfo = {
          id: "0x123",
          name: "MySchema:RelatedClass",
          label: "Related Class",
        };
        const relationshipPath: RelatedClassInfo[] = [
          {
            sourceClassInfo: propertyClass,
            targetClassInfo: recordClass,
            relationshipInfo: {
              id: "0x123",
              name: "MySchema:MyRelationship",
              label: "My Relationship",
            },
            isForwardRelationship: false,
            isPolymorphicRelationship: true,
            isPolymorphicTargetClass: true,
          },
        ];
        const field = createTestPropertiesContentField({
          type: createStringTypeDescription(),
          properties: [
            {
              property: {
                classInfo: propertyClass,
                type: "string",
                name: "MyProperty",
              },
            },
          ],
        });
        const parentField = createTestNestedContentField({
          pathToPrimaryClass: relationshipPath,
          nestedFields: [field],
        });
        const record = createTestContentItem({
          classInfo: recordClass,
          values: {
            [parentField.name]: [
              {
                primaryKeys: [],
                values: {
                  [field.name]: "test value",
                },
                displayValues: {
                  [field.name]: "test display value",
                },
                mergedFieldNames: [field.name],
              },
            ],
          },
          displayValues: {
            [field.name]: undefined,
          },
        });
        await expect(factory.createSimilarInstancesRuleset(field, record)).to.eventually.be.rejectedWith(
          "Can't create 'similar instances' ruleset for merged values",
        );
      });
    });
  });
});
