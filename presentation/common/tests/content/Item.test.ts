/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { createRandomECClassInfoJSON } from "../_helpers/random";
import Item, { ItemJSON } from "../../lib/content/Item";

describe("Item", () => {

  describe("fromJSON", () => {

    let testItemJSON!: ItemJSON;
    beforeEach(() => {
      testItemJSON = {
        primaryKeys: [],
        label: faker.random.words(),
        imageId: faker.random.uuid(),
        classInfo: createRandomECClassInfoJSON(),
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

    it("creates valid Item from valid JSON without classInfo", () => {
      const item = Item.fromJSON({ ...testItemJSON, classInfo: undefined });
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Item.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

  describe("isFieldMerged", () => {

    it("returns false for unmerged field", () => {
      const item = new Item([], faker.random.word(), faker.random.uuid(),
        undefined, { key: faker.random.word() }, { key: faker.random.word() }, []);
      expect(item.isFieldMerged("key")).to.be.false;
    });

    it("returns true for merged field", () => {
      const item = new Item([], faker.random.word(), faker.random.uuid(),
        undefined, { key: faker.random.word() }, { key: faker.random.word() }, ["key"]);
      expect(item.isFieldMerged("key")).to.be.true;
    });

  });

});
