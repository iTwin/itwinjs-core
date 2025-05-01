/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Content, ContentJSON } from "../../presentation-common/content/Content.js";
import { Item } from "../../presentation-common/content/Item.js";
import { createTestContentDescriptor } from "../_helpers/Content.js";
import { createTestECClassInfo, createTestECInstanceKey, createTestLabelDefinition } from "../_helpers/index.js";

describe("Content", () => {
  describe("constructor", () => {
    it("creates a new instance", () => {
      const descriptor = createTestContentDescriptor({ fields: [] });
      const contentSet = new Array<Item>();
      const content = new Content(descriptor, contentSet);
      expect(content.descriptor).to.eq(descriptor);
      expect(content.contentSet).to.eq(contentSet);
    });
  });

  describe("fromJSON", () => {
    let testContentJSON!: ContentJSON;
    beforeEach(() => {
      testContentJSON = {
        descriptor: {
          connectionId: "",
          contentFlags: 0,
          displayType: "",
          inputKeysHash: "",
          selectClasses: [],
          categories: [],
          fields: [],
          classesMap: {},
        },
        contentSet: [
          {
            classInfo: createTestECClassInfo(),
            primaryKeys: [createTestECInstanceKey()],
            labelDefinition: createTestLabelDefinition(),
            mergedFieldNames: [],
            values: {
              test: 123,
            },
            displayValues: {
              test: "123",
            },
          },
        ],
      };
    });

    it("creates valid Content from valid JSON", () => {
      const content = Content.fromJSON(testContentJSON);
      expect(content).to.matchSnapshot();
    });

    it("creates valid Content from valid serialized JSON", () => {
      const content = Content.fromJSON(JSON.stringify(testContentJSON));
      expect(content).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const content = Content.fromJSON(undefined);
      expect(content).to.be.undefined;
    });

    it("returns undefined if content has undefined descriptor", () => {
      const json = { ...testContentJSON, descriptor: undefined } as any;
      const content = Content.fromJSON(json);
      expect(content).to.be.undefined;
    });

    it("skips undefined items in content set", () => {
      const json = { ...testContentJSON, contentSet: [...testContentJSON.contentSet, undefined] } as any;
      const content = Content.fromJSON(json);
      expect(content!.contentSet.length).to.eq(1);
    });
  });
});
