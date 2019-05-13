/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Backstage } from "../../ui-ninezone";

describe("<Backstage />", () => {
  let addEventListenerSpy: sinon.SinonSpy | undefined;
  let removeEventListenerSpy: sinon.SinonSpy | undefined;

  afterEach(() => {
    addEventListenerSpy && addEventListenerSpy.restore();
    removeEventListenerSpy && removeEventListenerSpy.restore();
  });

  it("should render", () => {
    mount(<Backstage />);
  });

  it("renders correctly", () => {
    shallow(<Backstage />).should.matchSnapshot();
  });

  it("should set is-open class", () => {
    shallow(<Backstage isOpen={true} />).should.matchSnapshot();
  });

  it("should render header", () => {
    shallow(<Backstage header={"my header"} />).should.matchSnapshot();
  });

  it("should render footer", () => {
    shallow(<Backstage footer={"my footer"} />).should.matchSnapshot();
  });

  it("should add event listener", () => {
    addEventListenerSpy = sinon.spy(document, "addEventListener");

    mount(<Backstage />);
    addEventListenerSpy.calledOnce.should.true;
  });

  it("should remove event listener", () => {
    removeEventListenerSpy = sinon.spy(document, "removeEventListener");
    const sut = mount(<Backstage />);
    sut.unmount();

    removeEventListenerSpy.calledOnce.should.true;
  });

  it("should handle overlay click events", () => {
    const handler = sinon.spy();
    const component = mount(<Backstage onClose={handler} />);

    component.find(".nz-backstage-backstage_overlay").simulate("click");
    handler.calledOnce.should.true;
  });

  it("should handle escape key down close event", () => {
    const handler = sinon.spy();
    mount(<Backstage isOpen={true} onClose={handler} />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    handler.calledOnce.should.true;
  });
});
