/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { shallow } from "enzyme";
import { FrontstageManager, FrontstageDef, WidgetPanelsFrontstageContent } from "../../ui-framework";

describe("WidgetPanelsFrontstageContent", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    sandbox.stub(frontstageDef, "contentLayoutDef").get(() => ({}));
    sandbox.stub(frontstageDef, "contentGroup").get(() => ({}));
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const sut = shallow(<WidgetPanelsFrontstageContent />);
    sut.should.matchSnapshot();
  });

  it("should not render", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsFrontstageContent />);
    sut.should.matchSnapshot();
  });
});
