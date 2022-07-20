/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyDescription } from "@itwin/appui-abstract";
import { PropertyFilterRuleGroup, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { Field, PropertyValueFormat } from "@itwin/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestECClassInfo, createTestNestedContentField, createTestPropertiesContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import {
  createInstanceFilterPropertyInfos, createPresentationInstanceFilter, INSTANCE_FILTER_FIELD_SEPARATOR,
} from "../../presentation-components/instance-filter-builder/Utils";

describe("createInstanceFilterPropertyInfos", () => {

  it("creates property infos when fields are in root category", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const descriptor = createTestContentDescriptor({
      categories: [rootCategory],
      fields: [
        createTestPropertiesContentField({
          properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "string"}}],
          category: rootCategory }),
        createTestPropertiesContentField({
          properties:[{property: {classInfo: createTestECClassInfo(), name: "prop2", type: "number"}}],
          category: rootCategory }),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.matchSnapshot();
  });

  it("creates property infos when fields are in different categories category", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const nestedCategory1 = createTestCategoryDescription({ name: "nested1", label: "Nested Category 1", parent: rootCategory });
    const nestedCategory2 = createTestCategoryDescription({ name: "nested2", label: "Nested Category 2", parent: rootCategory });
    const nestedCategory21 = createTestCategoryDescription({ name: "nested21", label: "Nested Category 2 1", parent: nestedCategory2 });
    const descriptor = createTestContentDescriptor({
      categories: [rootCategory, nestedCategory1, nestedCategory2, nestedCategory21],
      fields: [
        createTestPropertiesContentField({
          properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "string"}}],
          category: nestedCategory1 }),
        createTestPropertiesContentField({
          properties:[{property: {classInfo: createTestECClassInfo(), name: "prop2", type: "number"}}],
          category: nestedCategory21 }),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.matchSnapshot();
  });

  it("creates property infos when property fields are in nested fields", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const propertyField1 = createTestPropertiesContentField({
      properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "string"}}],
      category: rootCategory });
    const propertyField2 = createTestPropertiesContentField({
      properties:[{property: {classInfo: createTestECClassInfo(), name: "prop2", type: "number"}}],
      category: rootCategory });

    const descriptor = createTestContentDescriptor({
      categories: [rootCategory],
      fields: [
        createTestNestedContentField({nestedFields: [propertyField1], category: rootCategory}),
        createTestNestedContentField({nestedFields: [propertyField2], category: rootCategory}),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.matchSnapshot();
  });

  it("ignores navigation properties", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const descriptor = createTestContentDescriptor({
      categories: [rootCategory],
      fields: [
        createTestPropertiesContentField({
          properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "navigation"}}],
          category: rootCategory,
          type: {valueFormat: PropertyValueFormat.Primitive, typeName: "navigation"} }),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.have.lengthOf(0);
  });

});

describe("createPresentationInstanceFilter", () => {
  const category = createTestCategoryDescription({ name: "root", label: "Root"});
  const propertyField1 = createTestPropertiesContentField({
    properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "string"}}],
    category,
    name: "propField1",
  });
  const propertyField2 = createTestPropertiesContentField({
    properties:[{property: {classInfo: createTestECClassInfo(), name: "prop1", type: "string"}}],
    category,
    name: "propField1",
  });
  const descriptor = createTestContentDescriptor({
    categories: [category],
    fields: [propertyField1, propertyField2],
  });

  function getPropertyDescriptionName(field: Field) {
    return `${INSTANCE_FILTER_FIELD_SEPARATOR}${field.name}`;
  }

  it("finds properties fields for property description", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: {name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string"},
        operator: PropertyFilterRuleOperator.IsNull,
      }, {
        property: {name: getPropertyDescriptionName(propertyField2), displayLabel: "Prop2", typename: "string"},
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.matchSnapshot();
  });

  it("returns filter condition when group has only one rule", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: {name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string"},
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.containSubset({
      operator: PropertyFilterRuleOperator.IsNull,
      field: propertyField1,
    });
  });

  it("returns undefined if filter group is empty", () => {
    expect(createPresentationInstanceFilter(descriptor, {operator: PropertyFilterRuleGroupOperator.And, rules: []})).to.be.undefined;
  });

  it("returns undefined when rule properties field cannot be found", () => {
    const property: PropertyDescription = {name: `${INSTANCE_FILTER_FIELD_SEPARATOR}invalidFieldName`, displayLabel: "Prop", typename: "string"};
    expect(createPresentationInstanceFilter(descriptor, {property, operator: PropertyFilterRuleOperator.IsNull})).to.be.undefined;
  });

  it("returns undefined when group has rule with invalid property field", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: {name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string"},
        operator: PropertyFilterRuleOperator.IsNull,
      }, {
        property: {name: `${INSTANCE_FILTER_FIELD_SEPARATOR}invalidFieldName`, displayLabel: "Prop2", typename: "string"},
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.be.undefined;
  });
});
