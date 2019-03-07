/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import {
  ConfigurableCreateInfo,
  NavigationAidControl,
  ContentGroupProps,
  ContentGroupManager,
  ContentGroup,
  ContentProps,
  ConfigurableUiManager,
} from "../../ui-framework";
import TestUtils from "../TestUtils";

describe("ContentGroup", () => {

  class TestContentControl extends NavigationAidControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div>Test</div>;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("ContentGroupManager.loadGroup should throw Error if ContentGroupProps does not have an id", () => {
    const groupProps: ContentGroupProps = {
      contents: [{ id: "myContent", classId: TestContentControl }],
    };
    expect(() => ContentGroupManager.loadGroup(groupProps)).to.throw(Error);
  });

  it("ContentGroup.getContentControl should throw Error if content type is not Content or Viewport", () => {
    const contentProps: ContentProps = { id: "myContent", classId: "TestContentControl" };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    ConfigurableUiManager.unregisterControl("TestContentControl");
    ConfigurableUiManager.registerControl("TestContentControl", TestContentControl);
    expect(() => contentGroup.getContentControl(contentProps, 0)).to.throw(Error);
    ConfigurableUiManager.unregisterControl("TestContentControl");
  });

});
