/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Item, ItemJSON } from "../../presentation-common/content/Item";
import { createTestContentItem, createTestLabelDefinition } from "../_helpers";
import { createTestECInstanceKey } from "../_helpers/EC";
import { createRandomECClassInfo, createRandomECInstanceKey, createRandomLabelDefinition } from "../_helpers/random";
import { NestedContentValue } from "../../presentation-common/content/Value";

describe("Item", () => {
  describe("constructor", () => {
    it("creates valid item with label string", () => {
      const item = createTestContentItem({ label: "test", values: {}, displayValues: {} });
      expect(item.label).to.matchSnapshot();
    });

    it("creates valid item with label definition", () => {
      const item = createTestContentItem({ label: createTestLabelDefinition(), values: {}, displayValues: {} });
      expect(item.label).to.matchSnapshot();
    });
  });

  describe("toJSON", () => {
    it("serializes inputKeys", () => {
      const inputKey = createTestECInstanceKey();
      const item = createTestContentItem({ inputKeys: [inputKey], values: {}, displayValues: {} });
      const json = item.toJSON();
      expect(json.inputKeys).to.deep.eq([inputKey]);
    });
  });

  describe("fromJSON", () => {
    let testItemJSON!: ItemJSON;
    beforeEach(() => {
      testItemJSON = {
        primaryKeys: [],
        labelDefinition: createRandomLabelDefinition(),
        classInfo: createRandomECClassInfo(),
        values: {
          key1: faker.random.number(),
          key2: faker.random.words(),
        },
        displayValues: {
          key1: faker.random.words(),
          key2: faker.random.words(),
        },
        mergedFieldNames: ["key1"],
      };
    });

    it("creates valid Item from valid JSON", () => {
      const item = Item.fromJSON(testItemJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid Item from valid serialized JSON", () => {
      const item = Item.fromJSON(JSON.stringify(testItemJSON));
      expect(item).to.matchSnapshot();
    });

    it("creates valid Item from JSON with inputKeys", () => {
      const inputKey = createTestECInstanceKey();
      const item = createTestContentItem({
        inputKeys: [inputKey],
        values: {},
        displayValues: {},
      });
      expect(item.inputKeys).to.deep.eq([inputKey]);
    });

    it("creates valid Item from JSON with extended data", () => {
      const item = createTestContentItem({
        extendedData: {
          x: 123,
        },
        values: {},
        displayValues: {},
      });
      expect(item.extendedData).to.deep.eq({ x: 123 });
    });

    it("creates valid Item with undefined values", () => {
      const item = Item.fromJSON({
        ...testItemJSON,
        values: { key1: undefined },
        displayValues: { key1: undefined },
      });
      expect(item).to.matchSnapshot();
    });

    it("creates valid Item with nested content values", () => {
      const nestedContentValue: NestedContentValue = {
        primaryKeys: [createRandomECInstanceKey()],
        values: { nested: undefined },
        displayValues: { nested: "" },
        mergedFieldNames: [faker.random.word()],
      };
      const item = Item.fromJSON({
        ...testItemJSON,
        displayValues: { key1: undefined },
        values: {
          key1: [nestedContentValue],
        },
      });
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Item.fromJSON(undefined);
      expect(item).to.be.undefined;
    });
  });

  describe("isFieldMerged", () => {
    it("returns false for unmerged field", () => {
      const item = createTestContentItem({ values: {}, displayValues: {}, mergedFieldNames: [] });
      expect(item.isFieldMerged("key")).to.be.false;
    });

    it("returns true for merged field", () => {
      const item = createTestContentItem({ values: {}, displayValues: {}, mergedFieldNames: ["key"] });
      expect(item.isFieldMerged("key")).to.be.true;
    });
  });
});
