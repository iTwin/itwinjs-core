/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { shallow } from "enzyme";
import { WidgetPanelsToolbars, FrontstageDef, FrontstageManager, WidgetDef, ZoneDef } from "../../ui-framework";

describe("WidgetPanelsToolbars", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should not render", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsToolbars />);
    sut.should.matchSnapshot();
  });

  it("should render toolbars", () => {
    const frontstageDef = new FrontstageDef();
    const topLeft = new ZoneDef();
    const topRight = new ZoneDef();
    const topLeftWidget = new WidgetDef({});
    const topRightWidget = new WidgetDef({});
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(frontstageDef, "topLeft").get(() => topLeft);
    sandbox.stub(frontstageDef, "topRight").get(() => topRight);
    sandbox.stub(topLeft, "getSingleWidgetDef").returns(topLeftWidget);
    sandbox.stub(topRight, "getSingleWidgetDef").returns(topRightWidget);
    sandbox.stub(topLeftWidget, "reactElement").get(() => <>tools</>);
    sandbox.stub(topRightWidget, "reactElement").get(() => <>navigation</>);
    const sut = shallow(<WidgetPanelsToolbars />);
    sut.should.matchSnapshot();
  });
});
