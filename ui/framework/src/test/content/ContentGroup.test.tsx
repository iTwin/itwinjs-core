/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, ContentControl, ContentGroup, ContentGroupManager, ContentGroupProps, ContentProps,
  NavigationAidControl,
} from "../../ui-framework";
import TestUtils from "../TestUtils";

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
    ConfigurableUiManager.registerControl("TestContentControl", TestNavigationAidControl);
    expect(() => contentGroup.getContentControl(contentProps, 0)).to.throw(Error);
    ConfigurableUiManager.unregisterControl("TestContentControl");
  });

  it("ContentGroup.getControlFromElement should log Error if passed an invalid node", () => {
    const spyMethod = sinon.spy(Logger, "logError");

    const contentProps: ContentProps = { id: "myContent", classId: "TestContentControl" };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    contentGroup.getControlFromElement(null);

    spyMethod.called.should.true;
  });

  it("ContentGroup.toJSON should throw Error if class not registered", () => {
    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    expect(() => contentGroup.toJSON()).to.throw(Error);
  });

  it("ContentGroup.toJSON should generate properly props for constructor classId", () => {
    const classId = "TestContentControl";
    ConfigurableUiManager.registerControl(classId, TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const props = contentGroup.toJSON();
    expect(props.contents[0].classId).to.eq(classId);

    ConfigurableUiManager.unregisterControl(classId);
  });

  it("ContentGroup.toJSON should generate properly props for string classId", () => {
    const classId = "TestContentControl";
    ConfigurableUiManager.registerControl(classId, TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const props = contentGroup.toJSON();
    expect(props.contents[0].classId).to.eq(classId);

    ConfigurableUiManager.unregisterControl(classId);
  });

  it("ContentGroup.getViewports should return array with undefined with no viewports", () => {
    ConfigurableUiManager.registerControl("TestContentControl", TestContentControl);

    const contentProps: ContentProps = { id: "myContent", classId: TestContentControl };
    const groupProps: ContentGroupProps = {
      contents: [contentProps],
    };
    const contentGroup = new ContentGroup(groupProps);

    const viewports = contentGroup.getViewports();
    expect(viewports[0]).to.eq(undefined);

    ConfigurableUiManager.unregisterControl("TestContentControl");
  });

});
