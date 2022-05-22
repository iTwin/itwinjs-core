/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { FrontstageDef, FrontstageManager, WidgetDef, WidgetPanelsToolbars, ZoneDef } from "../../appui-react";

describe("WidgetPanelsToolbars", () => {
  it("should not render", () => {
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsToolbars />);
    sut.should.matchSnapshot();
  });

  it("should render toolbars", () => {
    const frontstageDef = new FrontstageDef();
    const topLeft = new ZoneDef();
    const topRight = new ZoneDef();
    const topLeftWidget = new WidgetDef({});
    const topRightWidget = new WidgetDef({});
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sinon.stub(frontstageDef, "topLeft").get(() => topLeft);
    sinon.stub(frontstageDef, "topRight").get(() => topRight);
    sinon.stub(topLeft, "getSingleWidgetDef").returns(topLeftWidget);
    sinon.stub(topRight, "getSingleWidgetDef").returns(topRightWidget);
    sinon.stub(topLeftWidget, "reactNode").get(() => <>tools</>);
    sinon.stub(topRightWidget, "reactNode").get(() => <>navigation</>);
    const sut = shallow(<WidgetPanelsToolbars />);
    sut.should.matchSnapshot();
  });
});
