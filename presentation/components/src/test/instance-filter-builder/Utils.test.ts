/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { PropertyFilter, PropertyFilterRule, PropertyFilterRuleGroup, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { Field } from "@itwin/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestECClassInfo, createTestNestedContentField, createTestPropertiesContentField,
} from "@itwin/presentation-common/lib/cjs/test";
import {
  convertPresentationFilterToPropertyFilter,
  createInstanceFilterPropertyInfos, createPresentationInstanceFilter, INSTANCE_FILTER_FIELD_SEPARATOR,
} from "../../presentation-components/instance-filter-builder/Utils";
import { PresentationInstanceFilter } from "../../presentation-components";

function getPropertyDescriptionName(field: Field) {
  return `${INSTANCE_FILTER_FIELD_SEPARATOR}${field.name}`;
}

describe("createInstanceFilterPropertyInfos", () => {

  it("creates property infos when fields are in root category", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const descriptor = createTestContentDescriptor({
      categories: [rootCategory],
      fields: [
        createTestPropertiesContentField({
          properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
          category: rootCategory,
        }),
        createTestPropertiesContentField({
          properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop2", type: "number" } }],
          category: rootCategory,
        }),
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
          properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
          category: nestedCategory1,
        }),
        createTestPropertiesContentField({
          properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop2", type: "number" } }],
          category: nestedCategory21,
        }),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.matchSnapshot();
  });

  it("creates property infos when property fields are in nested fields", () => {
    const rootCategory = createTestCategoryDescription({ name: "root", label: "Root Category" });
    const propertyField1 = createTestPropertiesContentField({
      properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
      category: rootCategory,
    });
    const propertyField2 = createTestPropertiesContentField({
      properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop2", type: "number" } }],
      category: rootCategory,
    });

    const descriptor = createTestContentDescriptor({
      categories: [rootCategory],
      fields: [
        createTestNestedContentField({ nestedFields: [propertyField1], category: rootCategory }),
        createTestNestedContentField({ nestedFields: [propertyField2], category: rootCategory }),
      ],
    });

    const input = createInstanceFilterPropertyInfos(descriptor);
    expect(input).to.matchSnapshot();
  });
});

describe("createPresentationInstanceFilter", () => {
  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const propertyField1 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
    category,
    name: "propField1",
  });
  const propertyField2 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
    category,
    name: "propField1",
  });
  const descriptor = createTestContentDescriptor({
    categories: [category],
    fields: [propertyField1, propertyField2],
  });

  it("finds properties fields for property description", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
      }, {
        property: { name: getPropertyDescriptionName(propertyField2), displayLabel: "Prop2", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.matchSnapshot();
  });

  it("returns filter condition when group has only one rule", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.containSubset({
      operator: PropertyFilterRuleOperator.IsNull,
      field: propertyField1,
    });
  });

  it("returns undefined if filter group is empty", () => {
    expect(createPresentationInstanceFilter(descriptor, { operator: PropertyFilterRuleGroupOperator.And, rules: [] })).to.be.undefined;
  });

  it("returns undefined when rule properties field cannot be found", () => {
    const property: PropertyDescription = { name: `${INSTANCE_FILTER_FIELD_SEPARATOR}invalidFieldName`, displayLabel: "Prop", typename: "string" };
    expect(createPresentationInstanceFilter(descriptor, { property, operator: PropertyFilterRuleOperator.IsNull })).to.be.undefined;
  });

  it("returns undefined when group has rule with invalid property field", () => {
    const filter: PropertyFilterRuleGroup = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
      }, {
        property: { name: `${INSTANCE_FILTER_FIELD_SEPARATOR}invalidFieldName`, displayLabel: "Prop2", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
      }],
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.be.undefined;
  });

  it("returns undefined when rule has non primitive value", () => {
    const filter: PropertyFilterRule = {
      property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
      operator: PropertyFilterRuleOperator.IsEqual,
      value: { valueFormat: PropertyValueFormat.Array, items: [], itemsTypeName: "number" },
    };
    expect(createPresentationInstanceFilter(descriptor, filter)).to.be.undefined;
  });
});

describe("convertPresentationInstanceFilterToInstanceFilter", () => {
  const category = createTestCategoryDescription({ name: "root", label: "Root" });
  const propertyField1 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop1", type: "string" } }],
    category,
    name: "propField1",
    label: "Prop1",
  });
  const propertyField2 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop2", type: "string" } }],
    category,
    name: "propField2",
    label: "Prop2",
  });
  const propertyField3 = createTestPropertiesContentField({
    properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop3", type: "string" } }],
    category,
    name: "propField3",
    label: "Prop3",
  });
  const nestedField = createTestNestedContentField({
    nestedFields: [propertyField3],
    category,
    name: "nestedField",
    label: "NestedProp",
  });
  const nestedField2 = createTestNestedContentField({
    nestedFields: [nestedField],
    category,
    name: "nestedField2",
    label: "NestedProp2",
  });
  propertyField3.rebuildParentship(nestedField);
  const descriptor = createTestContentDescriptor({
    categories: [category],
    fields: [propertyField1, propertyField2, nestedField2],
  });

  it(" Property filter converts to presentation filter and vise versa correctly ", () => {
    const filter: PropertyFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }, {
        property: { name: getPropertyDescriptionName(propertyField2), displayLabel: "Prop2", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    };

    const presentationFilter = createPresentationInstanceFilter(descriptor, filter);
    const result = convertPresentationFilterToPropertyFilter(descriptor, presentationFilter);
    expect(result).to.be.deep.eq(filter);
  });

  it("Converts presentation filter with nested conditions to property filter", () => {
    const presentationFilter: PresentationInstanceFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      conditions: [{
        operator: PropertyFilterRuleGroupOperator.And,
        conditions: [{
          field: propertyField1,
          operator: PropertyFilterRuleOperator.IsNull,
          value: undefined,
        }],
      }],
    };

    const propertyFilter: PropertyFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        operator: PropertyFilterRuleGroupOperator.And,
        rules: [{
          property: { name: getPropertyDescriptionName(propertyField1), displayLabel: "Prop1", typename: "string" },
          operator: PropertyFilterRuleOperator.IsNull,
          value: undefined,
        }],
      }],
    };

    const result = convertPresentationFilterToPropertyFilter(descriptor, presentationFilter);
    expect(result).to.be.deep.eq(propertyFilter);
  });

  it("converts presentation filter with nested fields to property filter", () => {
    const presentationFilter: PresentationInstanceFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      conditions: [{
        field: propertyField3,
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    };

    const propertyFilter: PropertyFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      rules: [{
        property: { name: `${getPropertyDescriptionName(nestedField2)}$${nestedField.name}$${propertyField3.name}`, displayLabel: "Prop3", typename: "string" },
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    };

    const result = convertPresentationFilterToPropertyFilter(descriptor, presentationFilter);
    expect(result).to.be.deep.eq(propertyFilter);
  });

  it("returns undefined if filter is not passed", () => {
    const result = convertPresentationFilterToPropertyFilter(descriptor);
    expect(result).to.be.undefined;
  });

  it("returns undefined if property used in filter is not found in descriptor", () => {
    const propertyField = createTestPropertiesContentField({
      properties: [{ property: { classInfo: createTestECClassInfo(), name: "prop", type: "string" } }],
      category,
      name: "propField",
      label: "Prop",
    });

    const presentationFilter: PresentationInstanceFilter = {
      operator: PropertyFilterRuleGroupOperator.And,
      conditions: [{
        field: propertyField,
        operator: PropertyFilterRuleOperator.IsNull,
        value: undefined,
      }],
    };

    const result = convertPresentationFilterToPropertyFilter(descriptor, presentationFilter);
    expect(result).to.be.undefined;
  });
});
