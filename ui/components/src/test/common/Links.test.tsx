
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { matchLinks } from "../../ui-components/common/Links";

describe("matchlinks", () => {

  it("detects any number of any type of url links or emails in a passed value", () => {
    const testLinksWithIndexes = [
      { link: "https://www.testLink.com", linkIndexes: [{ index: 0, lastIndex: 24 }] },
      { link: "https://www.testLink.com/path/to/something", linkIndexes: [{ index: 0, lastIndex: 42 }] },
      { link: "https://www.testLink.com/with%20%20spaces", linkIndexes: [{ index: 0, lastIndex: 41 }] },
      { link: "http://www.testLink.com", linkIndexes: [{ index: 0, lastIndex: 23 }] },
      { link: "http://www.testLink.com/with%20%20spaces", linkIndexes: [{ index: 0, lastIndex: 40 }] },
      { link: "www.testLink.com", linkIndexes: [{ index: 0, lastIndex: 16 }] },
      { link: "www.testLink.com/with%20%20spaces", linkIndexes: [{ index: 0, lastIndex: 33 }] },
      { link: "testLink.com", linkIndexes: [] },
      { link: "text without any links or emai addreses", linkIndexes: [] },
      { link: "test link string www.testLink.com", linkIndexes: [{ index: 17, lastIndex: 33 }] },
      { link: "test link www.testLink.com string", linkIndexes: [{ index: 10, lastIndex: 26 }] },
      { link: "testLink.com www.TestLinkTwo.com", linkIndexes: [{ index: 13, lastIndex: 32 }] },
      { link: "www.testLink.com www.TestLinkTwo.com", linkIndexes: [{ index: 0, lastIndex: 16 }, { index: 17, lastIndex: 36 }] },
      { link: "https://www.testLink.com https://www.TestLinkTwo.com", linkIndexes: [{ index: 0, lastIndex: 24 }, { index: 25, lastIndex: 52 }] },
      { link: "test link1: www.testLink.com, test link two: www.testLink.com", linkIndexes: [{ index: 12, lastIndex: 28 }, { index: 45, lastIndex: 61 }] },
      { link: "Link to explorer: pw://server.bentley.com:datasource-01/Documents/ProjectName", linkIndexes: [{ index: 18, lastIndex: 77 }] },
      { link: "pw://server.bentley.com:datasource-01/Documents/with%20%20spaces", linkIndexes: [{ index: 0, lastIndex: 64 }] },
      { link: "pw://server:datasource/Documents/P{7185c257-e735-4395-8655-ebeeb180c08a}/", linkIndexes: [{ index: 0, lastIndex: 73 }] },
      { link: "pw:\\\\server.bentley.com:datasource-01/Documents/with%20%20spaces", linkIndexes: [{ index: 0, lastIndex: 64 }] },
      { link: "pw:\\\\server:datasource/Documents/P{7185c257-e735-4395-8655-ebeeb180c08a}/", linkIndexes: [{ index: 0, lastIndex: 73 }] },
      { link: "pw:\\\\  server:datasource /Docume nts/P{7185c257-e735-4395-8655-ebeeb180c08a}/", linkIndexes: [{ index: 0, lastIndex: 77 }] },
    ];
    testLinksWithIndexes.forEach(({ link, linkIndexes }) => {
      const linkMatches = matchLinks(link);
      expect(linkMatches.length).to.be.equal(linkIndexes.length, `'${link}' should have ${linkIndexes.length} links.`);
      for (let i = 0; i < linkMatches.length; i++) {
        expect(linkMatches[i].index).to.be.equal(linkIndexes[i].index);
        expect(linkMatches[i].lastIndex).to.be.equal(linkIndexes[i].lastIndex);
      }
    });
  });
});
