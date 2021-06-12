/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EnumerationInfo, FieldHierarchy, traverseContentItem } from "@bentley/presentation-common";
import {
  createTestCategoryDescription, createTestContentDescriptor, createTestContentItem, createTestNestedContentField, createTestPropertiesContentField,
  createTestSimpleContentField,
} from "@bentley/presentation-common/lib/test/_helpers/Content";
import { createTestECInstanceKey, createTestPropertyInfo } from "@bentley/presentation-common/lib/test/_helpers/EC";
import { ArrayValue, PropertyRecord, StructValue } from "@bentley/ui-abstract";
import { FieldHierarchyRecord, IPropertiesAppender, PropertyRecordsBuilder } from "../../presentation-components/common/ContentBuilder";

class TestPropertyRecordsBuilder extends PropertyRecordsBuilder {
  public entries: Array<{ record: PropertyRecord, fieldHierarchy: FieldHierarchy }> = [];
  protected createRootPropertiesAppender(): IPropertiesAppender {
    return {
      append: (record: FieldHierarchyRecord) => { this.entries.push(record); },
    };
  }
}

describe("PropertyRecordsBuilder", () => {

  let builder: TestPropertyRecordsBuilder;

  beforeEach(() => {
    builder = new TestPropertyRecordsBuilder();
  });

  it("sets enum props", () => {
    const enumerationInfo: EnumerationInfo = {
      choices: [{ value: 1, label: "One" }],
      isStrict: true,
    };
    const descriptor = createTestContentDescriptor({
      fields: [createTestPropertiesContentField({
        properties: [{
          property: createTestPropertyInfo({ enumerationInfo }),
          relatedClassPath: [],
        }],
      })],
    });
    const item = createTestContentItem({
      values: {},
      displayValues: {},
    });
    traverseContentItem(builder, descriptor, item);
    expect(builder.entries.length).to.eq(1);
    expect(builder.entries[0].record.property.enum).to.deep.eq(enumerationInfo);
  });

  it("sets extended data", () => {
    const descriptor = createTestContentDescriptor({
      fields: [createTestSimpleContentField()],
    });
    const extendedData = {
      test: 123,
    };
    const item = createTestContentItem({
      values: {},
      displayValues: {},
      extendedData,
    });
    traverseContentItem(builder, descriptor, item);
    expect(builder.entries.length).to.eq(1);
    expect(builder.entries[0].record.extendedData).to.deep.eq(extendedData);
  });

  it("sets `autoExpand` flag for nested content field based property records", () => {
    const category = createTestCategoryDescription();
    const descriptor = createTestContentDescriptor({
      fields: [createTestNestedContentField({
        name: "parent",
        category,
        autoExpand: true,
        nestedFields: [
          createTestSimpleContentField({ name: "child", category }),
        ],
      })],
    });
    const item = createTestContentItem({
      values: {
        parent: [{
          primaryKeys: [createTestECInstanceKey()],
          values: {
            child: "value",
          },
          displayValues: {
            child: "display value",
          },
          mergedFieldNames: [],
        }],
      },
      displayValues: {},
    });
    traverseContentItem(builder, descriptor, item);
    expect(builder.entries.length).to.eq(1);
    const record = builder.entries[0].record;
    expect(record.autoExpand).to.be.true;
    expect((record.value as ArrayValue).items[0].autoExpand).to.be.true;
    expect(((record.value as ArrayValue).items[0].value as StructValue).members.child.autoExpand).to.be.undefined;
  });

});
