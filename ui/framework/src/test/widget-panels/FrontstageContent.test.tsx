/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import sinon from "sinon";
import { FrontstageDef, FrontstageManager, WidgetPanelsFrontstageContent } from "../../ui-framework.js";

describe("WidgetPanelsFrontstageContent", () => {
  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "contentLayoutDef").get(() => ({}));
    sinon.stub(frontstageDef, "contentGroup").get(() => ({}));
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const sut = shallow(<WidgetPanelsFrontstageContent />);
    sut.should.matchSnapshot();
  });

  it("should not render", () => {
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const sut = shallow(<WidgetPanelsFrontstageContent />);
    sut.should.matchSnapshot();
  });
});
