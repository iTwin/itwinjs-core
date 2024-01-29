/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { NodePathElement } from "../presentation-common";
import { Content } from "../presentation-common/content/Content";
import { Item } from "../presentation-common/content/Item";
import { DisplayValueGroup, NavigationPropertyValue } from "../presentation-common/content/Value";
import { LabelCompositeValue, LabelDefinition } from "../presentation-common/LabelDefinition";
import { LocalizationHelper } from "../presentation-common/LocalizationHelper";
import {
  createRandomECInstancesNode,
  createRandomLabelCompositeValue,
  createRandomLabelDefinition,
  createTestCategoryDescription,
  createTestContentDescriptor,
  createTestContentItem,
  createTestECInstanceKey,
  createTestSimpleContentField,
} from "./_helpers";

function getTestLocalizedString(key: string) {
  if (key.includes(":")) {
    key = key.split(":", 2)[1];
  }
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
      const result = localizationHelper.getLocalizedNodes([node]);
      expect(result[0].label.rawValue).to.be.eq("LocalizedRawValue");
      expect(result[0].label.displayValue).to.be.eq("LocalizedDisplayValue");
      expect(result[0].description).to.be.eq("LocalizedDescription");
    });
  });

  describe("getLocalizedNodePathElement", () => {
    it("translates the node", () => {
      const node1 = createRandomECInstancesNode();
      node1.label.displayValue = "@namespace:LocalizedDisplayValue1@";

      const node2 = createRandomECInstancesNode();
      node2.label.displayValue = "@namespace:LocalizedDisplayValue2@";

      const npe: NodePathElement = {
        index: 0,
        node: node1,
        children: [
          {
            index: 0,
            node: node2,
            children: [],
          },
        ],
      };

      const result = localizationHelper.getLocalizedNodePathElement(npe);
      expect(result).to.containSubset({
        node: {
          label: { displayValue: "LocalizedDisplayValue1" },
        },
        children: [
          {
            node: {
              label: { displayValue: "LocalizedDisplayValue2" },
            },
          },
        ],
      });
    });
  });

  describe("getLocalizedDisplayValueGroup", () => {
    it("leaves undefined display value as-is", () => {
      const group: DisplayValueGroup = {
        displayValue: undefined,
        groupedRawValues: [],
      };
      const result = localizationHelper.getLocalizedDisplayValueGroup(group);
      expect(result.displayValue).to.be.undefined;
    });

    it("translates string display value", () => {
      const group: DisplayValueGroup = {
        displayValue: "@namespace:LocalizedDisplayValue@",
        groupedRawValues: [],
      };
      const result = localizationHelper.getLocalizedDisplayValueGroup(group);
      expect(result.displayValue).to.eq("LocalizedDisplayValue");
    });

    it("translates array display value", () => {
      const group: DisplayValueGroup = {
        displayValue: ["@namespace:LocalizedDisplayValue1@", "@namespace:LocalizedDisplayValue2@"],
        groupedRawValues: [],
      };
      const result = localizationHelper.getLocalizedDisplayValueGroup(group);
      expect(result.displayValue).to.deep.eq(["LocalizedDisplayValue1", "LocalizedDisplayValue2"]);
    });

    it("translates object display value", () => {
      const group: DisplayValueGroup = {
        displayValue: {
          x: "@namespace:LocalizedDisplayValue1@",
          y: "@namespace:LocalizedDisplayValue2@",
        },
        groupedRawValues: [],
      };
      const result = localizationHelper.getLocalizedDisplayValueGroup(group);
      expect(result.displayValue).to.deep.eq({ x: "LocalizedDisplayValue1", y: "LocalizedDisplayValue2" });
    });
  });

  describe("getLocalizedContent", () => {
    it("translates contentItem labelDefinitions", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.label.rawValue = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.contentSet[0]!.label.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates contentItem value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.values.property = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.contentSet[0]!.values.property).to.be.eq("LocalizedValue");
    });

    it("translates contentItem nested value", () => {
      const contentItem = createTestContentItem({
        values: {
          parent: [
            {
              primaryKeys: [createTestECInstanceKey()],
              values: {
                child: "@namespace:LocalizedValue@",
              },
              displayValues: {
                child: "@namespace:DisplayValue@",
              },
              mergedFieldNames: [],
            },
          ],
        },
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.contentSet[0]!.values.parent)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            displayValues: {
              child: "DisplayValue",
            },
            mergedFieldNames: [],
            primaryKeys: [createTestECInstanceKey()],
            values: {
              child: "LocalizedValue",
            },
          },
        ]);
    });

    it("translates contentItem display value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.displayValues.property = "@namespace:LocalizedValue@";
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.contentSet[0]!.displayValues.property).to.be.eq("LocalizedValue");
    });

    it("does not translate contentItem non-translatable value", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      contentItem.values.property = 10;
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.contentSet[0]!.values.property).to.be.eq(10);
    });

    it("translates content descriptor field label", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const field = createTestSimpleContentField({ label: "@namespace:LocalizedValue@" });
      const content = new Content(createTestContentDescriptor({ fields: [field] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.descriptor.fields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor category label", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const testCategory = createTestCategoryDescription({ label: "@namespace:LocalizedLabel@" });
      const field = createTestSimpleContentField({ category: testCategory });
      const content = new Content(createTestContentDescriptor({ fields: [field], categories: [testCategory] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.descriptor.categories[0].label).to.be.eq("LocalizedLabel");
    });

    it("translates content descriptor category description", () => {
      const contentItem = new Item([], createRandomLabelDefinition(), "", undefined, {}, {}, []);
      const testCategory = createTestCategoryDescription({ description: "@namespace:LocalizedDescription@" });
      const field = createTestSimpleContentField({ category: testCategory });
      const content = new Content(createTestContentDescriptor({ fields: [field], categories: [testCategory] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      expect(result.descriptor.categories[0].description).to.be.eq("LocalizedDescription");
    });

    it("translates navigation property value label", () => {
      const navigationPropertyValue: NavigationPropertyValue = {
        id: "0x1",
        className: "Schema:Class",
        label: createRandomLabelDefinition(),
      };
      navigationPropertyValue.label.rawValue = "@namespace:LocalizedValue@";
      const contentItem = createTestContentItem({
        values: {
          navigationProperty: navigationPropertyValue,
        },
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.getLocalizedContent(content);
      const localizedValue = result.contentSet[0]!.values.navigationProperty as NavigationPropertyValue;
      expect(localizedValue.label.rawValue).to.be.eq("LocalizedValue");
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
      const result = localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(result.rawValue).to.be.eq("LocalizedValue");
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
      const result = localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      (result.rawValue as LabelCompositeValue).values.forEach((value) => {
        expect(value.rawValue).to.be.eq("LocalizedValue");
      });
    });

    it("does not translate non string value", () => {
      const labelDefinition: LabelDefinition = {
        displayValue: "10",
        rawValue: 10,
        typeName: "int",
      };
      const result = localizationHelper.getLocalizedLabelDefinition(labelDefinition);
      expect(result.rawValue).to.be.eq(10);
    });
  });

  describe("getLocalizedLabelDefinitions", () => {
    it("translates labelDefinitions", () => {
      const labelDefinitions = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      labelDefinitions.forEach((labelDefinition) => (labelDefinition.rawValue = "@namespace:LocalizedValue@"));
      const result = localizationHelper.getLocalizedLabelDefinitions(labelDefinitions);
      result.forEach((labelDefinition) => {
        expect(labelDefinition.rawValue).to.be.eq("LocalizedValue");
      });
    });
  });
});
