/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Backstage, BackstageProps, SafeAreaInsets } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<Backstage />", () => {
  it("should render", () => {
    mount(<Backstage />);
  });

  it("renders correctly", () => {
    shallow(<Backstage />).should.matchSnapshot();
  });

  it("should set is-open class", () => {
    shallow(<Backstage isOpen />).should.matchSnapshot();
  });

  it("should render header", () => {
    shallow(<Backstage header="my header" />).should.matchSnapshot();
  });

  it("should render footer", () => {
    shallow(<Backstage footer="my footer" />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<Backstage safeAreaInsets={SafeAreaInsets.All} />).should.matchSnapshot();
  });

  it("should add event listener", () => {
    const addEventListenerSpy = sinon.spy(document, "addEventListener");

    mount(<Backstage />);
    addEventListenerSpy.calledOnce.should.true;
  });

  it("should remove event listener", () => {
    const removeEventListenerSpy = sinon.spy(document, "removeEventListener");
    const sut = mount(<Backstage />);
    sut.unmount();

    removeEventListenerSpy.calledOnce.should.true;
  });

  it("should handle overlay click events", () => {
    const spy = sinon.stub<Required<BackstageProps>["onClose"]>();
    const component = mount(<Backstage onClose={spy} />);

    component.find(".nz-backstage-backstage_overlay").simulate("click");
    spy.calledOnce.should.true;
  });

  it("should handle escape key down close event", () => {
    const spy = sinon.stub<Required<BackstageProps>["onClose"]>();
    mount(<Backstage isOpen onClose={spy} />);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    spy.calledOnce.should.true;
  });
});
