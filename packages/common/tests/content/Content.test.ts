/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { createRandomECInstanceKeyJSON, createRandomECClassInfoJSON, createRandomDescriptorJson } from "@helpers/random";
import { Content } from "@src/content";
import { ContentJSON } from "@src/content/Content";

describe("Content", () => {

  describe("fromJSON", () => {

    let testContentJSON!: ContentJSON;
    beforeEach(() => {
      testContentJSON = {
        descriptor: createRandomDescriptorJson(),
        contentSet: [{
          classInfo: createRandomECClassInfoJSON(),
          primaryKeys: [createRandomECInstanceKeyJSON()],
          label: faker.random.words(),
          imageId: faker.random.uuid(),
          mergedFieldNames: [],
          values: {
            test: faker.random.number(),
          },
          displayValues: {
            test: faker.random.words(),
          },
        }],
      };
    });

    it("creates valid Content from valid JSON", () => {
      const item = Content.fromJSON(testContentJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid Content from valid serialized JSON", () => {
      const item = Content.fromJSON(JSON.stringify(testContentJSON));
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Content.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

});
