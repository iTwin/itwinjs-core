/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Item, ItemJSON } from "../../presentation-common/content/Item";
import { NestedContentValueJSON } from "../../presentation-common/content/Value";
import { createTestContentItem, createTestLabelDefinition } from "../_helpers";
import { createTestECInstanceKey } from "../_helpers/EC";
import { createRandomECClassInfo, createRandomECInstanceKey, createRandomLabelDefinition } from "../_helpers/random";

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
        imageId: faker.random.uuid(),
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

    it("creates valid Item with null values", () => {
      const item = Item.fromJSON({
        ...testItemJSON,
        values: { key1: null },
        displayValues: { key1: null },
      });
      expect(item).to.matchSnapshot();
    });

    it("creates valid Item with nested content values", () => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const nestedContentValueJSON: NestedContentValueJSON = {
        primaryKeys: [createRandomECInstanceKey()],
        values: { nested: null },
        displayValues: { nested: "" },
        mergedFieldNames: [faker.random.word()],
      };
      const item = Item.fromJSON({
        ...testItemJSON,
        displayValues: { key1: null },
        values: {
          key1: [nestedContentValueJSON],
        },
      });
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Item.fromJSON(undefined);
      expect(item).to.be.undefined;
    });
  });

  describe("listFromJSON", () => {
    it("parses items from JSON", () => {
      const items = [
        createTestContentItem({ values: { a: "b" }, displayValues: { a: "B" } }),
        createTestContentItem({ values: { c: "d" }, displayValues: { c: "D" } }),
      ];
      expect(Item.listFromJSON(items.map((i) => i.toJSON()))).to.matchSnapshot();
    });

    it("parses items from serialized JSON string", () => {
      const items = [
        createTestContentItem({ values: { a: "b" }, displayValues: { a: "B" } }),
        createTestContentItem({ values: { c: "d" }, displayValues: { c: "D" } }),
      ];
      expect(Item.listFromJSON(JSON.stringify(items))).to.matchSnapshot();
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
