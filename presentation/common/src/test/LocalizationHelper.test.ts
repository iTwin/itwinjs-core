/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ArrayPropertiesField, NestedContentField, NodePathElement, StructPropertiesField } from "../presentation-common.js";
import { Content } from "../presentation-common/content/Content.js";
import { DisplayValueGroup, NavigationPropertyValue } from "../presentation-common/content/Value.js";
import { COMPOSITE_LABEL_DEFINITION_TYPENAME, LabelCompositeValue, LabelDefinition } from "../presentation-common/LabelDefinition.js";
import { LocalizationHelper } from "../presentation-common/LocalizationHelper.js";
import {
  createTestArrayPropertiesContentField,
  createTestCategoryDescription,
  createTestContentDescriptor,
  createTestContentItem,
  createTestECInstanceKey,
  createTestECInstancesNode,
  createTestLabelDefinition,
  createTestNestedContentField,
  createTestPropertiesContentField,
  createTestPropertyInfo,
  createTestSimpleContentField,
  createTestStructPropertiesContentField,
} from "./_helpers/index.js";

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

  describe("localizeNodes", () => {
    it("translates labelDefinition", () => {
      const node = createTestECInstancesNode();
      node.label.rawValue = "@namespace:LocalizedRawValue@";
      node.label.displayValue = "@namespace:LocalizedDisplayValue@";
      node.description = "@namespace:LocalizedDescription@";
      const result = localizationHelper.localizeNodes([node]);
      expect(result[0].label.rawValue).to.be.eq("LocalizedRawValue");
      expect(result[0].label.displayValue).to.be.eq("LocalizedDisplayValue");
      expect(result[0].description).to.be.eq("LocalizedDescription");
    });
  });

  describe("localizeNodePathElement", () => {
    it("translates the node", () => {
      const node1 = createTestECInstancesNode();
      node1.label.displayValue = "@namespace:LocalizedDisplayValue1@";

      const node2 = createTestECInstancesNode();
      node2.label.displayValue = "@namespace:LocalizedDisplayValue2@";

      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

      const result = localizationHelper.localizeNodePathElement(npe);
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

  describe("localizeDisplayValueGroup", () => {
    it("leaves undefined display value as-is", () => {
      const group: DisplayValueGroup = {
        displayValue: undefined,
        groupedRawValues: [],
      };
      const result = localizationHelper.localizeDisplayValueGroup(group);
      expect(result.displayValue).to.be.undefined;
    });

    it("translates string display value", () => {
      const group: DisplayValueGroup = {
        displayValue: "@namespace:LocalizedDisplayValue@",
        groupedRawValues: [],
      };
      const result = localizationHelper.localizeDisplayValueGroup(group);
      expect(result.displayValue).to.eq("LocalizedDisplayValue");
    });

    it("translates array display value", () => {
      const group: DisplayValueGroup = {
        displayValue: ["@namespace:LocalizedDisplayValue1@", "@namespace:LocalizedDisplayValue2@"],
        groupedRawValues: [],
      };
      const result = localizationHelper.localizeDisplayValueGroup(group);
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
      const result = localizationHelper.localizeDisplayValueGroup(group);
      expect(result.displayValue).to.deep.eq({ x: "LocalizedDisplayValue1", y: "LocalizedDisplayValue2" });
    });
  });

  describe("localizeContent", () => {
    it("translates content item label", () => {
      const contentItem = createTestContentItem({
        label: createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue@" }),
        values: {},
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].label.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates content item direct value", () => {
      const contentItem = createTestContentItem({
        values: {
          property: "@namespace:LocalizedRawValue@",
        },
        displayValues: {
          property: "@namespace:LocalizedDisplayValue@",
        },
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].values.property).to.be.eq("LocalizedRawValue");
      expect(result.contentSet[0].displayValues.property).to.be.eq("LocalizedDisplayValue");
    });

    it("translates content item direct array item values", () => {
      const contentItem = createTestContentItem({
        values: {
          property: ["@namespace:LocalizedRawValue1@", "@namespace:LocalizedRawValue2@"],
        },
        displayValues: {
          property: ["@namespace:LocalizedDisplayValue1@", "@namespace:LocalizedDisplayValue2@"],
        },
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const rawArray = contentItem.values.property;
      const displayArray = contentItem.displayValues.property;
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].values.property).to.eq(rawArray).and.to.deep.eq(["LocalizedRawValue1", "LocalizedRawValue2"]);
      expect(result.contentSet[0].displayValues.property).to.eq(displayArray).and.to.deep.eq(["LocalizedDisplayValue1", "LocalizedDisplayValue2"]);
    });

    it("translates content item direct struct member values", () => {
      const contentItem = createTestContentItem({
        values: {
          property: {
            prop1: "@namespace:LocalizedRawValue1@",
            prop2: "@namespace:LocalizedRawValue2@",
          },
        },
        displayValues: {
          property: {
            prop1: "@namespace:LocalizedDisplayValue1@",
            prop2: "@namespace:LocalizedDisplayValue2@",
          },
        },
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const rawMap = contentItem.values.property;
      const displayMap = contentItem.displayValues.property;
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].values.property).to.eq(rawMap).and.to.deep.eq({ prop1: "LocalizedRawValue1", prop2: "LocalizedRawValue2" });
      expect(result.contentSet[0].displayValues.property)
        .to.eq(displayMap)
        .and.to.deep.eq({ prop1: "LocalizedDisplayValue1", prop2: "LocalizedDisplayValue2" });
    });

    it("translates navigation property value", () => {
      const navigationPropertyValue: NavigationPropertyValue = {
        id: "0x1",
        className: "Schema:Class",
        label: createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue@" }),
      };
      const contentItem = createTestContentItem({
        values: {
          navigationProperty: navigationPropertyValue,
        },
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.localizeContent(content);
      const localizedValue = result.contentSet[0].values.navigationProperty as NavigationPropertyValue;
      expect(localizedValue).to.eq(navigationPropertyValue);
      expect(localizedValue.label).to.eq(navigationPropertyValue.label);
      expect(localizedValue.label.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates content item nested value", () => {
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
      const nestedItems = contentItem.values.parent;
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].values.parent).to.eq(nestedItems);
      expect(result.contentSet[0].values.parent)
        .to.have.lengthOf(1)
        .and.to.containSubset([
          {
            primaryKeys: [createTestECInstanceKey()],
            values: {
              child: "LocalizedValue",
            },
            displayValues: {
              child: "DisplayValue",
            },
            mergedFieldNames: [],
          },
        ]);
    });

    it("does not translate content item non-translatable value", () => {
      const contentItem = createTestContentItem({
        values: {
          property: 10,
        },
        displayValues: {},
      });
      const content = new Content(createTestContentDescriptor({ fields: [] }), [contentItem]);
      const result = localizationHelper.localizeContent(content);
      expect(result.contentSet[0].values.property).to.be.eq(10);
    });

    it("translates content descriptor direct field label", () => {
      const field = createTestSimpleContentField({ label: "@namespace:LocalizedValue@" });
      const descriptor = createTestContentDescriptor({ fields: [field] });
      const result = localizationHelper.localizeContentDescriptor(descriptor);
      expect(result.fields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor direct struct member field label", () => {
      const field = createTestStructPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
        memberFields: [
          createTestPropertiesContentField({
            name: "member1",
            label: "@namespace:LocalizedValue@",
            properties: [{ property: createTestPropertyInfo() }],
          }),
        ],
      });
      const descriptor = createTestContentDescriptor({ fields: [field] });
      const result = localizationHelper.localizeContentDescriptor(descriptor);
      expect((result.fields[0] as StructPropertiesField).memberFields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor direct struct array member field label", () => {
      const field = createTestArrayPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
        itemsField: createTestStructPropertiesContentField({
          properties: [{ property: createTestPropertyInfo() }],
          memberFields: [
            createTestPropertiesContentField({
              name: "member1",
              label: "@namespace:LocalizedValue@",
              properties: [{ property: createTestPropertyInfo() }],
            }),
          ],
        }),
      });
      const descriptor = createTestContentDescriptor({ fields: [field] });
      const result = localizationHelper.localizeContentDescriptor(descriptor);
      expect(((result.fields[0] as ArrayPropertiesField).itemsField as StructPropertiesField).memberFields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor nested field label", () => {
      const nestedField = createTestSimpleContentField({ label: "@namespace:LocalizedValue@" });
      const nestingField = createTestNestedContentField({ nestedFields: [nestedField] });
      const descriptor = createTestContentDescriptor({ fields: [nestingField] });
      const result = localizationHelper.localizeContentDescriptor(descriptor);
      expect((result.fields[0] as NestedContentField).nestedFields[0]).to.eq(nestedField);
      expect((result.fields[0] as NestedContentField).nestedFields[0].label).to.be.eq("LocalizedValue");
    });

    it("translates content descriptor category label & description", () => {
      const contentItem = createTestContentItem({ values: {}, displayValues: {} });
      const testCategory = createTestCategoryDescription({
        label: "@namespace:LocalizedLabel@",
        description: "@namespace:LocalizedDescription@",
      });
      const field = createTestSimpleContentField({ category: testCategory });
      const content = new Content(createTestContentDescriptor({ fields: [field], categories: [testCategory] }), [contentItem]);
      const result = localizationHelper.localizeContent(content);
      expect(result.descriptor.categories[0]).to.eq(testCategory);
      expect(result.descriptor.fields[0].category).to.eq(testCategory);
      expect(result.descriptor.categories[0].label).to.be.eq("LocalizedLabel");
      expect(result.descriptor.categories[0].description).to.be.eq("LocalizedDescription");
    });

    it("translates element properties label", () => {
      const elementProperties = localizationHelper.localizeElementProperties({ class: "class", label: "@namespace:LocalizedLabel@", id: "id", items: {} });
      expect(elementProperties.label).to.be.eq("LocalizedLabel");
    });
  });

  describe("localizeLabelDefinition", () => {
    it("translates labelDefinition", () => {
      const labelDefinition = createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue@" });
      const result = localizationHelper.localizeLabelDefinition(labelDefinition);
      expect(result.rawValue).to.be.eq("LocalizedValue");
    });

    it("translates labelDefinition with composite value", () => {
      const labelDefinition: LabelDefinition = {
        displayValue: "Display",
        rawValue: {
          separator: "/",
          values: [
            createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue@" }),
            createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue@" }),
          ],
        },
        typeName: COMPOSITE_LABEL_DEFINITION_TYPENAME,
      };
      const result = localizationHelper.localizeLabelDefinition(labelDefinition);
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
      const result = localizationHelper.localizeLabelDefinition(labelDefinition);
      expect(result.rawValue).to.be.eq(10);
    });
  });

  describe("localizeLabelDefinitions", () => {
    it("translates labelDefinitions", () => {
      const labelDefinitions = [
        createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue1@" }),
        createTestLabelDefinition({ rawValue: "@namespace:LocalizedValue2@" }),
      ];
      const result = localizationHelper.localizeLabelDefinitions(labelDefinitions);
      expect(result.map((d) => d.rawValue)).to.deep.eq(["LocalizedValue1", "LocalizedValue2"]);
    });
  });
});
