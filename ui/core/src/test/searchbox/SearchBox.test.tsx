/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { SearchBox } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("SearchBox", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("renders", () => {
    it("should render", () => {
      const wrapper = mount(<SearchBox onValueChanged={() => { }} placeholder="Search" />);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(<SearchBox onValueChanged={() => { }} />).should.matchSnapshot();
    });
  });

  describe("track change", () => {
    it("should call onValueChanged", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<SearchBox onValueChanged={spyMethod} />);
      const inputNode = wrapper.find("input");

      expect(inputNode.length).to.eq(1);
      if (inputNode) {
        const testValue = "Test";
        inputNode.simulate("change", { target: { value: testValue } });
        wrapper.update();
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should honor valueChangedDelay", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<SearchBox onValueChanged={spyMethod} valueChangedDelay={100} />);
      const inputNode = wrapper.find("input");

      expect(inputNode.length).to.eq(1);
      if (inputNode) {
        const testValue = "Test";
        inputNode.simulate("change", { target: { value: testValue } });

        setTimeout(() => {
          expect(spyMethod.called).to.be.false;
        }, 1);
        setTimeout(() => {
          expect(spyMethod.calledOnce).to.be.true;
          wrapper.unmount();
        }, 100);
      }
    });

    it("should call onEscPressed", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<SearchBox onValueChanged={() => { }} onEscPressed={spyMethod} />);
      const inputNode = wrapper.find("input");

      expect(inputNode.length).to.eq(1);
      if (inputNode) {
        inputNode.simulate("keyDown", { key: "Escape" });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should call onEnterPressed", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<SearchBox onValueChanged={() => { }} onEnterPressed={spyMethod} />);
      const inputNode = wrapper.find("input");

      expect(inputNode.length).to.eq(1);
      if (inputNode) {
        inputNode.simulate("keyDown", { key: "Enter" });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should call onClear", () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(<SearchBox onValueChanged={() => { }} onClear={spyMethod} initialValue="Test" />);

      const buttonNode = wrapper.find("div.searchbox-button");
      expect(buttonNode.length).to.eq(1);

      buttonNode.simulate("click");
      expect(spyMethod.calledOnce).to.be.true;
    });
  });
});
