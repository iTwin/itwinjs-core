
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { matchLinks } from "../../ui-components/common/Links";

describe("matchlinks", () => {

  it("detects any number of any type of url links or emails in a passed value", () => {
    const testLinksWithIndexes = [
      { link: "testLink.com", linksIndexes: [{ index: 0, lastIndex: 12 }] },
      { link: "text without any links or emai addreses", linksIndexes: [] },
      { link: "www.testLink.com", linksIndexes: [{ index: 0, lastIndex: 16 }] },
      { link: "https://www.testLink.com", linksIndexes: [{ index: 0, lastIndex: 24 }] },
      { link: "test link string testLink.com", linksIndexes: [{ index: 17, lastIndex: 29 }] },
      { link: "test link testLink.com string", linksIndexes: [{ index: 10, lastIndex: 22 }] },
      { link: "testLink.com www.TestLinkTwo.com", linksIndexes: [{ index: 0, lastIndex: 12 }, { index: 13, lastIndex: 32 }] },
      { link: "www.testLink.com www.TestLinkTwo.com", linksIndexes: [{ index: 0, lastIndex: 16 }, { index: 17, lastIndex: 36 }] },
      { link: "https://www.testLink.com https://www.TestLinkTwo.com", linksIndexes: [{ index: 0, lastIndex: 24 }, { index: 25, lastIndex: 52 }] },
      { link: "test links string testLink.com, TestLinkTwo.com", linksIndexes: [{ index: 18, lastIndex: 30 }, { index: 32, lastIndex: 47 }] },
      { link: "test links testLink.com string TestLinkTwo.com", linksIndexes: [{ index: 11, lastIndex: 23 }, { index: 31, lastIndex: 46 }] },
      { link: "testLink.com testLink.com", linksIndexes: [{ index: 0, lastIndex: 12 }, { index: 13, lastIndex: 25 }] },
      { link: "test link1: testLink.com, test link two: testLink.com", linksIndexes: [{ index: 12, lastIndex: 24 }, { index: 41, lastIndex: 53 }] },
      { link: "Link to explorer: pw://server.bentley.com:datasource-01/Documents/ProjectName", linksIndexes: [{ index: 18, lastIndex: 77 }] },
      { link: "pw://server:datasource/Documents/P{7185c257-e735-4395-8655-ebeeb180c08a}/", linksIndexes: [{ index: 0, lastIndex: 73 }] },
    ];
    testLinksWithIndexes.forEach((testLinkWithIndexes) => {
      const linkResults = matchLinks(testLinkWithIndexes.link);
      expect(linkResults.length).to.be.equal(testLinkWithIndexes.linksIndexes.length);
      for (let i = 0; i < linkResults.length; i++) {
        expect(linkResults[i].index).to.be.equal(testLinkWithIndexes.linksIndexes[i].index);
        expect(linkResults[i].lastIndex).to.be.equal(testLinkWithIndexes.linksIndexes[i].lastIndex);
      }
    });
  });
});
