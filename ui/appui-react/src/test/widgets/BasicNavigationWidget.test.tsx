/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { Matrix3d } from "@itwin/core-geometry";
import { MockRender, OrthographicViewState, ScreenViewport } from "@itwin/core-frontend";
import { BasicNavigationWidget, CommandItemDef, ConfigurableUiManager, ContentViewManager, ToolbarHelper, ViewportContentControl } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("BasicNavigationWidget", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
    ConfigurableUiManager.initialize();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("BasicNavigationWidget should render", () => {
    mount(<BasicNavigationWidget />);
  });

  it("BasicNavigationWidget should render correctly", () => {
    shallow(<BasicNavigationWidget />).should.matchSnapshot();
  });

  const testH1Def = new CommandItemDef({
    commandId: "test-h1-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-h1-tool",
  });

  const testV1Def = new CommandItemDef({
    commandId: "test-v1-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-v1-tool",
  });

  const testV2Def = new CommandItemDef({
    commandId: "test-v2-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-v2-tool",
  });

  const testH2Def = new CommandItemDef({
    commandId: "test-h2-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-h2-tool",
  });

  it("BasicNavigationWidget with suffix and prefix items should render correctly", () => {
    shallow(<BasicNavigationWidget additionalVerticalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testV1Def, testV2Def])}
      additionalHorizontalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testH1Def, testH2Def])} />).should.matchSnapshot();
  });

  it("BasicNavigationWidget should refresh when props change", () => {
    const wrapper = mount(<BasicNavigationWidget additionalVerticalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testV1Def, testV2Def])}
      additionalHorizontalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testH1Def, testH2Def])} />);

    wrapper.setProps({ additionalHorizontalItems: undefined, additionalVerticalItems: undefined });
  });

  it("BasicNavigationWidget should init navigation aid from active content control", () => {
    const viewportMock = moq.Mock.ofType<ScreenViewport>();
    const contentControlMock = moq.Mock.ofType<ViewportContentControl>();
    contentControlMock.setup((control) => control.viewport).returns(() => viewportMock.object);
    contentControlMock.setup((control) => control.navigationAidControl).returns(() => "StandardRotationNavigationAid");

    const spatialViewStateMock = moq.Mock.ofType<OrthographicViewState>();
    spatialViewStateMock.setup((view) => view.is3d()).returns(() => true);
    spatialViewStateMock.setup((view) => view.classFullName).returns(() => "Bis:OrthographicViewDefinition");
    const rotation = Matrix3d.createIdentity();
    spatialViewStateMock.setup((view) => view.getRotation()).returns(() => rotation);

    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => spatialViewStateMock.object);

    sinon.stub(ContentViewManager, "getActiveContentControl").returns(contentControlMock.object);

    mount(<BasicNavigationWidget />);
  });

});
