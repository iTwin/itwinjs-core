/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { shallow } from "enzyme";
import { FrontstageManager, FrontstageDef, WidgetPanelsStatusBar, WidgetDef, ZoneDef } from "../../ui-framework";

describe("WidgetPanelsStatusBar", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const widget = new WidgetDef({});
    const bottomCenter = new ZoneDef();
    const frontstageDef = new FrontstageDef();
    sandbox.stub(frontstageDef, "bottomCenter").get(() => bottomCenter);
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(bottomCenter, "getSingleWidgetDef").returns(widget);
    sandbox.stub(bottomCenter, "isStatusBar").get(() => true);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });

  it("should not render widget control", () => {
    const bottomCenter = new ZoneDef();
    const frontstageDef = new FrontstageDef();
    sandbox.stub(frontstageDef, "bottomCenter").get(() => bottomCenter);
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(bottomCenter, "getSingleWidgetDef").returns(undefined);
    sandbox.stub(bottomCenter, "isStatusBar").get(() => true);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });

  it("should not render", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });
});
