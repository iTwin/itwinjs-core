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
  let fakeTimers: sinon.SinonFakeTimers;

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  beforeEach(() => {
    fakeTimers = sinon.useFakeTimers();
  });

  afterEach(() => {
    fakeTimers.restore();
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
        fireEvent.change(inputNode, { target: { value: testValue } });
        expect(spyMethod.calledOnce).to.be.true;
      }
    });

    it("should ignore if value specified is not different", async () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={spyMethod} valueChangedDelay={100} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        const testValue = "Test";
        fireEvent.change(inputNode, { target: { value: testValue } });
        fireEvent.change(inputNode, { target: { value: "" } });
        await fakeTimers.tickAsync(100);
        expect(spyMethod.called).to.be.false;
      }
    });

    it("should honor valueChangedDelay", async () => {
      const spyMethod = sinon.spy();
      const component = render(<SearchBox onValueChanged={spyMethod} valueChangedDelay={100} />);
      const inputNode = component.container.querySelector("input") as HTMLElement;

      expect(inputNode).not.to.be.null;
      if (inputNode) {
        const testValue = "Test";
        fireEvent.change(inputNode, { target: { value: testValue } });

        await fakeTimers.tickAsync(1);
        expect(spyMethod.called).to.be.false;
        await fakeTimers.tickAsync(100);
        expect(spyMethod.calledOnce).to.be.true;
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
