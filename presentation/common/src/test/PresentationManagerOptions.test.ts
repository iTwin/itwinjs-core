/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import { Descriptor } from "../presentation-common/content/Descriptor";
import { InstanceKey } from "../presentation-common/EC";
import { NodeKey } from "../presentation-common/hierarchy/Key";
import { KeySet } from "../presentation-common/KeySet";
import {
  ContentDescriptorRequestOptions, ContentRequestOptions, DisplayLabelRequestOptions, DisplayLabelsRequestOptions, ExtendedContentRequestOptions,
  ExtendedHierarchyRequestOptions, HierarchyRequestOptions, isContentDescriptorRequestOptions, isDisplayLabelRequestOptions,
  isDisplayLabelsRequestOptions, isExtendedContentRequestOptions, isExtendedHierarchyRequestOptions, LabelRequestOptions,
} from "../presentation-common/PresentationManagerOptions";
import { createRandomBaseNodeKey, createRandomECInstanceKey } from "./_helpers/random";

describe("isContentDescriptorRequestOptions", () => {

  it("returns `false` for `ContentRequestOptions`", () => {
    const opts: ContentRequestOptions<any> = {
      imodel: undefined,
      rulesetOrId: "",
    };
    expect(isContentDescriptorRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `ContentDescriptorRequestOptions`", () => {
    const opts: ContentDescriptorRequestOptions<any, KeySet> = {
      imodel: undefined,
      rulesetOrId: "",
      displayType: "",
      keys: new KeySet(),
    };
    expect(isContentDescriptorRequestOptions(opts)).to.be.true;
  });

});

describe("isExtendedContentRequestOptions", () => {

  it("returns `false` for `ContentRequestOptions`", () => {
    const opts: ContentRequestOptions<any> = {
      imodel: undefined,
      rulesetOrId: "",
    };
    expect(isExtendedContentRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `ExtendedContentRequestOptions`", () => {
    const opts: ExtendedContentRequestOptions<any, Descriptor, KeySet> = {
      imodel: undefined,
      rulesetOrId: "",
      keys: new KeySet(),
      descriptor: new Descriptor({ contentFlags: 0, displayType: "", fields: [], selectClasses: [] }),
    };
    expect(isExtendedContentRequestOptions(opts)).to.be.true;
  });

});

describe("isExtendedHierarchyRequestOptions ", () => {

  it("returns `false` for `HierarchyRequestOptions`", () => {
    const opts: HierarchyRequestOptions<any> = {
      imodel: undefined,
      rulesetOrId: "",
    };
    expect(isExtendedHierarchyRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `ExtendedHierarchyRequestOptions`", () => {
    const opts: ExtendedHierarchyRequestOptions<any, NodeKey> = {
      imodel: undefined,
      rulesetOrId: "",
      parentKey: createRandomBaseNodeKey(),
    };
    expect(isExtendedHierarchyRequestOptions(opts)).to.be.true;
  });

});

describe("isDisplayLabelRequestOptions ", () => {

  it("returns `false` for `LabelRequestOptions`", () => {
    const opts: LabelRequestOptions<any> = {
      imodel: undefined,
    };
    expect(isDisplayLabelRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `DisplayLabelsRequestOptions`", () => {
    const opts: DisplayLabelRequestOptions<any, InstanceKey> = {
      imodel: undefined,
      key: createRandomECInstanceKey(),
    };
    expect(isDisplayLabelRequestOptions(opts)).to.be.true;
  });

});

describe("isDisplayLabelsRequestOptions ", () => {

  it("returns `false` for `LabelRequestOptions`", () => {
    const opts: LabelRequestOptions<any> = {
      imodel: undefined,
    };
    expect(isDisplayLabelsRequestOptions(opts)).to.be.false;
  });

  it("returns `true` for `DisplayLabelsRequestOptions`", () => {
    const opts: DisplayLabelsRequestOptions<any, InstanceKey> = {
      imodel: undefined,
      keys: [createRandomECInstanceKey(), createRandomECInstanceKey()],
    };
    expect(isDisplayLabelsRequestOptions(opts)).to.be.true;
  });

});
