/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as moq from "typemoq";
import * as sinon from "sinon";

import TestUtils from "../TestUtils";

import { BasicNavigationWidget } from "../../ui-framework/widgets/BasicNavigationWidget";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";
import { ToolbarHelper } from "../../ui-framework/toolbar/ToolbarHelper";
import { MockRender, ScreenViewport, OrthographicViewState } from "@bentley/imodeljs-frontend";
import { ConfigurableUiManager, ContentViewManager, ViewportContentControl } from "../../ui-framework";
import { Matrix3d } from "@bentley/geometry-core";

describe("BasicNavigationWidget", () => {
  const sandbox = sinon.createSandbox();

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
    ConfigurableUiManager.initialize();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("BasicNavigationWidget should render", () => {
    const wrapper = mount(<BasicNavigationWidget />);
    wrapper.unmount();
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

    sandbox.stub(ContentViewManager, "getActiveContentControl").returns(contentControlMock.object);

    const wrapper = mount(<BasicNavigationWidget />);
    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());
    wrapper.unmount();
  });

});
