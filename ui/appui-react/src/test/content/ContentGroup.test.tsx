/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, ContentGroupProps, ContentProps,
  NavigationAidControl,
  UiFramework,
} from "../../appui-react";
import TestUtils from "../TestUtils";
import { StandardContentLayouts } from "@itwin/appui-abstract";

describe("ContentGroup", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div>Test</div>;
    }
  }

  class TestNavigationAidControl extends NavigationAidControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div>Test</div>;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ContentGroup.getContentControl should throw Error if content type is not Content or Viewport", () => {
    const contentProps: ContentProps = { id: "myContent", classId: "TestContentControl" };
    const groupProps: ContentGroupProps = {
      id: "testGroup",
      layout: StandardContentLayouts.singleView,
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    UiFramework.controls.unregister("TestContentControl");
    UiFramework.controls.register("TestContentControl", TestNavigationAidControl);
    expect(() => contentGroup.getContentControl(contentProps, 0)).to.throw(Error);
    UiFramework.controls.unregister("TestContentControl");
  });

  it("ContentGroup.toJSON should throw Error if class not registered", () => {
    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      id: "testGroup",
      layout: StandardContentLayouts.singleView,
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    expect(() => contentGroup.toJSON()).to.throw(Error);
  });

  it("ContentGroup.toJSON should generate properly props for constructor classId", () => {
    const classId = "TestContentControl";
    UiFramework.controls.register(classId, TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      id: "testGroup",
      layout: StandardContentLayouts.singleView,
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const props = contentGroup.toJSON();
    expect(props.contents[0].classId).to.eq(classId);

    UiFramework.controls.unregister(classId);
  });

  it("ContentGroup.toJSON should generate properly props for string classId", () => {
    const classId = "TestContentControl";
    UiFramework.controls.register(classId, TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId };
    const groupProps: ContentGroupProps = {
      id: "testGroup",
      layout: StandardContentLayouts.singleView,
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const props = contentGroup.toJSON();
    expect(props.contents[0].classId).to.eq(classId);

    UiFramework.controls.unregister(classId);
  });

  it("ContentGroup.getViewports should return array with undefined with no viewports", () => {
    UiFramework.controls.register("TestContentControl", TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      id: "testGroup",
      layout: StandardContentLayouts.singleView,
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const viewports = contentGroup.getViewports();
    expect(viewports[0]).to.eq(undefined);

    UiFramework.controls.unregister("TestContentControl");
  });

});
