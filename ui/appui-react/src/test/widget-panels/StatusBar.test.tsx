/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { FrontstageDef, FrontstageManager, WidgetDef, WidgetPanelsStatusBar, ZoneDef } from "../../appui-react";

describe("WidgetPanelsStatusBar", () => {
  it("should render", () => {
    const widget = new WidgetDef({});
    const bottomCenter = new ZoneDef();
    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "bottomCenter").get(() => bottomCenter);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sinon.stub(bottomCenter, "getSingleWidgetDef").returns(widget);
    sinon.stub(bottomCenter, "isStatusBar").get(() => true);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });

  it("should not render widget control", () => {
    const bottomCenter = new ZoneDef();
    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "bottomCenter").get(() => bottomCenter);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sinon.stub(bottomCenter, "getSingleWidgetDef").returns(undefined);
    sinon.stub(bottomCenter, "isStatusBar").get(() => true);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });

  it("should not render", () => {
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsStatusBar />);
    sut.should.matchSnapshot();
  });
});
