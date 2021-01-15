/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { SearchBox } from "../../ui-core";
import TestUtils from "../TestUtils";
import { fireEvent, render } from "@testing-library/react";

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
      const component = render(<SearchBox onValueChanged={spyMethod} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        const testValue = "Test";
        fireEvent.change(inputNode,  { target: { value: testValue } });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should honor valueChangedDelay", () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={spyMethod} valueChangedDelay={100} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        const testValue = "Test";
        fireEvent.change(inputNode,  { target: { value: testValue } });

        setTimeout(() => {
          expect(spyMethod.called).to.be.false;
        }, 1);
        setTimeout(() => {
          expect(spyMethod.calledOnce).to.be.true;
        }, 100);
      }
    });

    it("should call onEscPressed", () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={() => { }} onEscPressed={spyMethod} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        fireEvent.keyDown(inputNode, { key: "Escape" });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should call onEnterPressed", () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={() => { }} onEnterPressed={spyMethod} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        fireEvent.keyDown(inputNode, { key: "Enter" });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should call onClear", () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={() => { }} onClear={spyMethod} initialValue="Test" />);

      const buttonNode = component.container.querySelector("div.core-searchbox-button") as HTMLElement;
      expect(buttonNode).not.to.be.null;

      fireEvent.click(buttonNode);
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("should set focus to input", () => {
      const wrapper = mount(<SearchBox onValueChanged={() => { }} placeholder="Search" />);
      const searchBox = wrapper.instance() as SearchBox;
      searchBox.focus();

      const input = wrapper.find("input");
      const focusedElement = document.activeElement;

      expect(input.instance()).to.eq(focusedElement);
      wrapper.unmount();
    });
  });
});
