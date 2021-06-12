/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { Content, PropertyValueFormat } from "@bentley/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestContentItem, createTestSimpleContentField,
} from "@bentley/presentation-common/lib/test/_helpers/Content";
import { createTestECClassInfo, createTestECInstanceKey } from "@bentley/presentation-common/lib/test/_helpers/EC";
import { buildElementProperties } from "../presentation-backend/ElementPropertiesHelper";

describe("buildElementProperties", () => {

  it("returns undefined when given undefined content", () => {
    expect(buildElementProperties(undefined)).to.be.undefined;
  });

  it("returns undefined when given content with not items", () => {
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [],
    ))).to.be.undefined;
  });

  it("sets class label", () => {
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          classInfo: createTestECClassInfo({ label: "Test label" }),
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset({ class: "Test label" });
  });

  it("sets element label", () => {
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          label: "Test label",
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset({ label: "Test label" });
  });

  it("sets invalid element id when content item has not primary keys", () => {
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          primaryKeys: [],
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset({ id: Id64.invalid });
  });

  it("sets element id", () => {
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({ fields: [] }),
      [
        createTestContentItem({
          primaryKeys: [createTestECInstanceKey({ id: "0x123" })],
          values: {},
          displayValues: {},
        }),
      ],
    ))).to.containSubset({ id: "0x123" });
  });

  it("categorizes properties", () => {
    const parentCategory = createTestCategoryDescription({ name: "cat1", label: "Parent Category" });
    const childCategory = createTestCategoryDescription({ name: "cat2", label: "Child Category", parent: parentCategory });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [parentCategory, childCategory],
        fields: [
          createTestSimpleContentField({ name: "prop1", label: "Prop One", category: parentCategory }),
          createTestSimpleContentField({ name: "prop2", label: "Prop Two", category: childCategory }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop1: "value1",
            prop2: "value2",
          },
          displayValues: {
            prop1: "Value One",
            prop2: "Value Two",
          },
        }),
      ],
    ))?.items).to.deep.eq({
      ["Parent Category"]: {
        type: "category",
        items: {
          ["Child Category"]: {
            type: "category",
            items: {
              ["Prop Two"]: {
                type: "primitive",
                value: "Value Two",
              },
            },
          },
          ["Prop One"]: {
            type: "primitive",
            value: "Value One",
          },
        },
      },
    });
  });

  it("sets primitive property value to empty string when it's not set", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({ name: "prop", label: "Prop", category }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: "value",
          },
          displayValues: {
            prop: undefined,
          },
        }),
      ],
    ))?.items).to.deep.eq({
      ["Test Category"]: {
        type: "category",
        items: {
          ["Prop"]: {
            type: "primitive",
            value: "",
          },
        },
      },
    });
  });

  it("sets property value to empty string when it's merged", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({ name: "prop", label: "Prop", category }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: "anything",
          },
          displayValues: {
            prop: "anything",
          },
          mergedFieldNames: ["prop"],
        }),
      ],
    ))?.items).to.deep.eq({
      ["Test Category"]: {
        type: "category",
        items: {
          ["Prop"]: {
            type: "primitive",
            value: "",
          },
        },
      },
    });
  });

  it("handles struct properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Struct,
              typeName: "Test Struct",
              members: [{
                name: "member1",
                label: "Member One",
                type: {
                  valueFormat: PropertyValueFormat.Primitive,
                  typeName: "Primitive One",
                },
              }, {
                name: "member2",
                label: "Member Two",
                type: {
                  valueFormat: PropertyValueFormat.Primitive,
                  typeName: "Primitive Two",
                },
              }],
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: {
              member1: "value1",
              member2: "value2",
            },
          },
          displayValues: {
            prop: {
              member1: "Value One",
              member2: "Value Two",
            },
          },
        }),
      ],
    ))?.items).to.deep.eq({
      ["Test Category"]: {
        type: "category",
        items: {
          ["Prop"]: {
            type: "struct",
            members: {
              ["Member One"]: {
                type: "primitive",
                value: "Value One",
              },
              ["Member Two"]: {
                type: "primitive",
                value: "Value Two",
              },
            },
          },
        },
      },
    });
  });

  it("handles primitive array properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Array,
              typeName: "Test Array",
              memberType: {
                valueFormat: PropertyValueFormat.Primitive,
                typeName: "Test Primitive",
              },
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: ["value1", "value2"],
          },
          displayValues: {
            prop: ["Value One", "Value Two"],
          },
        }),
      ],
    ))?.items).to.deep.eq({
      ["Test Category"]: {
        type: "category",
        items: {
          ["Prop"]: {
            type: "array",
            valueType: "primitive",
            values: ["Value One", "Value Two"],
          },
        },
      },
    });
  });

  it("handles struct array properties", () => {
    const category = createTestCategoryDescription({ label: "Test Category" });
    expect(buildElementProperties(new Content(
      createTestContentDescriptor({
        categories: [category],
        fields: [
          createTestSimpleContentField({
            name: "prop",
            label: "Prop",
            category,
            type: {
              valueFormat: PropertyValueFormat.Array,
              typeName: "Test Array",
              memberType: {
                valueFormat: PropertyValueFormat.Struct,
                typeName: "Test Struct",
                members: [{
                  name: "member",
                  label: "Test Member",
                  type: {
                    valueFormat: PropertyValueFormat.Primitive,
                    typeName: "Test Primitive",
                  },
                }],
              },
            },
          }),
        ],
      }),
      [
        createTestContentItem({
          values: {
            prop: [{
              member: "value1",
            }, {
              member: "value2",
            }],
          },
          displayValues: {
            prop: [{
              member: "Value One",
            }, {
              member: "Value Two",
            }],
          },
        }),
      ],
    ))?.items).to.deep.eq({
      ["Test Category"]: {
        type: "category",
        items: {
          ["Prop"]: {
            type: "array",
            valueType: "struct",
            values: [{
              ["Test Member"]: {
                type: "primitive",
                value: "Value One",
              },
            }, {
              ["Test Member"]: {
                type: "primitive",
                value: "Value Two",
              },
            }],
          },
        },
      },
    });
  });

});
