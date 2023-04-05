/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { createRandomECInstancesNode, createRandomLabelCompositeValue, createRandomLabelDefinition, createTestCategoryDescription, createTestContentDescriptor, createTestContentItem, createTestECInstanceKey, createTestSimpleContentField } from "./_helpers";
import { Content, Item, LabelDefinition, LocalizationHelper } from "../presentation-common";

function getTestLocalizedString(key: string) {
  if (key.includes(":"))
    key = key.split(":", 2)[1];
  return key;
}

describe("LocalizationHelper", () => {
  let localizationHelper: LocalizationHelper;

  beforeEach(() => {
    localizationHelper = new LocalizationHelper({ getLocalizedString: getTestLocalizedString });
  });

  describe("translate", () => {

    it("does not translate if key not found", () => {
      const key = "WrongKey";
      const translated = localizationHelper.getLocalizedString(key);
      expect(translated).to.be.eq(key);
    });

    it("trims key", () => {
      const key = "@namespace:LocalizedValue@";
      const translated = localizationHelper.getLocalizedString(key);
      expect(translated).to.be.eq("LocalizedValue");
    });

    it("translates string containing multiple keys", () => {
      const text = "Front @namespace:firstKey@ and @namespace:secondKey@ End";
      const translated = localizationHelper.getLocalizedString(text);
      expect(translated).to.be.eq("Front firstKey and secondKey End");
    });

  });

  describe("getLocalizedNodes", () => {

    it("translates labelDefinition", () => {
      const node = createRandomECInstancesNode();
      node.label.rawValue = "@namespace:LocalizedRawValue@";
      node.label.displayValue = "@namespace:LocalizedDisplayValue@";
      node.description = "@namespace:LocalizedDescription@";
      localizationHelper.getLocalizedNodes([node]);
      expect(node.label.rawValue).to.be.eq("LocalizedRawValue");
      expect(node.label.displayValue).to.be.eq("LocalizedDisplayValue");
      expect(node.description).to.be.eq("LocalizedDescription");
    });

  });

  describe("getLocalizedContent", () => {

    it("translates contentItem labelDefinitions", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.label.rawValue = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.label.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates contentItem value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.values.property = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.values.property).to.be.eq("LocalizedValue");
    });

    it("translates contentItem nested value", () => {
      const contentItem = createTestContentItem({
        values: {
          parent: [{
            primaryKeys: [createTestECInstanceKey()],
            values: {
              child: "@namespace:LocalizedValue@",
            },
            displayValues: {
              child: "@namespace:DisplayValue@",
            },
            mergedFieldNames: [],
          }],
        },
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.values.parent).to.have.lengthOf(1).and.to.containSubset([{
        displayValues: {
          child: "DisplayValue",
        },
        mergedFieldNames: [],
        primaryKeys: [createTestECInstanceKey()],
        values: {
          child: "LocalizedValue",
        },
      }]);
    });

    it("translates contentItem display value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.displayValues.property = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.displayValues.property).to.be.eq("LocalizedValue");
    });

    it("does not translate contentItem non-translatable value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.values.property = 10;
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.contentSet[0]!.values.property).to.be.eq(10);
    });

    it("translates content descriptor field label", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const field = createTestSimpleContentField({ label: "@namespace:LocalizedValue@" });
      const content = new Content(createTestContentDescriptor({ fields: [field] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.descriptor.fields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor category label", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const testCategory = createTestCategoryDescription({ label: "@namespace:LocalizedLabel@" });
      const field = createTestSimpleContentField({ category: testCategory });
      const content = new Content(createTestContentDescriptor({ fields: [field], categories: [testCategory] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.descriptor.categories[0].label).to.be.eq("LocalizedLabel");
    });

    it("translates content descriptor category description", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const testCategory = createTestCategoryDescription({ description: "@namespace:LocalizedDescription@" });
      const field = createTestSimpleContentField({ category: testCategory });
      const content = new Content(createTestContentDescriptor({ fields: [field], categories: [testCategory] }), [contentItem]);
      localizationHelper.getLocalizedContent(content);
      expect(content.descriptor.categories[0].description).to.be.eq("LocalizedDescription");
    });

    it("translates element properties label", () => {
      const elementProperties = localizationHelper.getLocalizedElementProperties({ class: "class", label: "@namespace:LocalizedLabel@", id: "id", items: {} });
      expect(elementProperties.label).to.be.eq("LocalizedLabel");
    });

  });

  describe("getLocalizedLabelDefinition", () => {

    it("translates labelDefinition", () => {
      const labelDefinition = createRandomLabelDefinition();
      labelDefinition.rawValue = "@namespace:LocalizedValue@";
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates labelDefinition with composite value", () => {
      const compositeValue = createRandomLabelCompositeValue();
      compositeValue.values.forEach((value) => {
        value.rawValue = "@namespace:LocalizedValue@";
      });
      const labelDefinition: LabelDefinition = {
        displayValue: "Display",
        rawValue: compositeValue,
        typeName: LabelDefinition.COMPOSITE_DEFINITION_TYPENAME,
      };
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      compositeValue.values.forEach((value) => {
        expect(value.rawValue).to.be.eq("LocalizedValue");
      });

    });

    it("does not translate non string value", () => {
      const labelDefinition: LabelDefinition = {
        displayValue: "10",
        rawValue: 10,
        typeName: "int",
      };
      localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(labelDefinition.rawValue).to.be.eq(10);
    });

  });

  describe("getLocalizedLabelDefinitions", () => {

    it("translates labelDefinitions", () => {
      const labelDefinitions = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      labelDefinitions.forEach((labelDefinition) => labelDefinition.rawValue = "@namespace:LocalizedValue@");
      localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
      labelDefinitions.forEach((labelDefinition) => {
        expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
      });
    });

  });

});
