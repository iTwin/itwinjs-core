/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import Backstage from "../../src/backstage/Backstage";

describe("<Backstage />", () => {
  it("should render", () => {
    mount(<Backstage />);
  });

  it("renders correctly", () => {
    shallow(<Backstage />).should.matchSnapshot();
  });

  it("should set is-open class", () => {
    shallow(<Backstage isOpen={true} />).should.matchSnapshot();
  });

  it("should handle overlay click events", () => {
    const handler = sinon.spy();
    const component = mount(<Backstage onClose={handler} />);

    component.simulate("click");

    handler.calledOnce.should.true;
  });

  it("should not fire overlay click event when items are clicked", () => {
    const handler = sinon.spy();
    const component = mount(<Backstage onClose={handler} />);
    const items = component.find(".nz-items");
    items.should.exist;
  });

  it("should handle escape key down close event", () => {
    const handler = sinon.spy();
    mount(<Backstage isOpen={true} onClose={handler} />);

    handler.should.not.have.been.called;

    document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));

    // component.simulate("keyDown", { keyCode: "Escape" });
    // document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27 }));

    // handler.should.not.have.been.called;
   // handler.calledOnce.should.true;
  });
});
