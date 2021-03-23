/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import tlr from "@testing-library/react"; const { cleanup, fireEvent, render } = tlr;
import sinon from "sinon";
import * as React from "react";
import { SpecialKey } from "@bentley/ui-abstract";
import { PopupButton } from "../../ui-components/editors/PopupButton.js";
import { TestUtils } from "../TestUtils.js";

describe("<PopupButton />", () => {
  it("should render", () => {
    const wrapper = mount(
      <PopupButton label="Hello">
        <div>Hello World</div>
      </PopupButton>);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <PopupButton label="Hello">
        <div>Hello World</div>
      </PopupButton>).should.matchSnapshot();
  });

  it("renders correctly with showArrow and showShadow", () => {
    shallow(
      <PopupButton label="Hello" showArrow={true} showShadow={true}>
        <div>Hello World</div>
      </PopupButton>).should.matchSnapshot();
  });

  it("calls onClick", async () => {
    const spyOnClick = sinon.spy();
    const component = render(
      <PopupButton label="Hello" onClick={spyOnClick}>
        <div data-testid="popup-test-div">Hello World</div>
      </PopupButton>);

    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;
    fireEvent.click(button);
    await TestUtils.flushAsyncOperations();

    expect(spyOnClick.calledOnce).to.be.true;

    const popupDiv = component.getByTestId("popup-test-div");
    expect(popupDiv).to.exist;

    cleanup();
  });

  it("shows the popup on down arrow", async () => {
    const component = render(
      <PopupButton label="Hello">
        <div data-testid="popup-test-div">Hello World</div>
      </PopupButton>);

    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;

    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: SpecialKey.ArrowDown }));
    await TestUtils.flushAsyncOperations();

    const popupDiv = component.getByTestId("popup-test-div");
    expect(popupDiv).to.exist;

    cleanup();
  });

  it("shows the popup on space bar", async () => {
    const component = render(
      <PopupButton label="Hello">
        <div data-testid="popup-test-div">Hello World</div>
      </PopupButton>);

    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;

    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: SpecialKey.Space }));
    await TestUtils.flushAsyncOperations();

    const popupDiv = component.getByTestId("popup-test-div");
    expect(popupDiv).to.exist;

    cleanup();
  });

  it("shows the popup on Enter", async () => {
    const component = render(
      <PopupButton label="Hello">
        <div data-testid="popup-test-div">Hello World</div>
      </PopupButton>);

    const button = component.getByTestId("components-popup-button");
    expect(button).to.exist;

    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: SpecialKey.Enter }));
    await TestUtils.flushAsyncOperations();

    const popupDiv = component.getByTestId("popup-test-div");
    expect(popupDiv).to.exist;

    cleanup();
  });

  it("calls onClose", async () => {
    const spyOnClose = sinon.spy();

    const wrapper = mount(
      <PopupButton label="Hello" onClose={spyOnClose}>
        <div>Hello World</div>
      </PopupButton>);

    const button = wrapper.find(".components-popup-button");
    expect(button.length).to.eq(1);
    button.first().simulate("click");
    await TestUtils.flushAsyncOperations();

    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));

    spyOnClose.calledOnce.should.true;

    wrapper.unmount();
  });

});
