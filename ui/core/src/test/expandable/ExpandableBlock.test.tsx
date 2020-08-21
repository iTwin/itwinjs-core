/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { SpecialKey } from "@bentley/ui-abstract";
import { ExpandableBlock } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("ExpandableBlock", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<ExpandableBlock />", () => {
    it("should render collapsed", () => {
      const wrapper = mount(
        <ExpandableBlock title="Test" isExpanded={false} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(wrapper.find(".is-collapsed").length).to.eq(1);
      wrapper.unmount();
    });

    it("should render expanded", () => {
      const wrapper = mount(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
      expect(wrapper.find(".is-expanded").length).to.eq(1);
      wrapper.unmount();
    });

    it("should render with caption", () => {
      const wrapper = mount(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()} caption="Test Caption">
          <div>Hello</div>
        </ExpandableBlock>);
      expect(wrapper.find(".with-caption").length).to.eq(1);
      wrapper.unmount();
    });

    it("should support click", () => {
      const spyMethod = sinon.fake();
      const wrapper = mount(
        <ExpandableBlock title="Test" isExpanded={true} onClick={spyMethod}>
          <div>Hello</div>
        </ExpandableBlock>);
      wrapper.find(".header").simulate("click");
      spyMethod.calledOnce.should.true;
      wrapper.unmount();
    });

    it("should support keypress", () => {
      const spyMethod = sinon.fake();
      const wrapper = mount(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()} onKeyPress={spyMethod}>
          <div>Hello</div>
        </ExpandableBlock>);
      wrapper.find(".header").simulate("keypress", { key: SpecialKey.ArrowDown /* <Down> */ });
      spyMethod.calledOnce.should.true;
      wrapper.unmount();
    });

    it("renders correctly collapsed", () => {
      shallow(
        <ExpandableBlock title="Test" isExpanded={false} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>).should.matchSnapshot();
    });

    it("renders correctly expanded", () => {
      shallow(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>).should.matchSnapshot();
    });
  });
});
