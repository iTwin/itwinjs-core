/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { IModelApp, MockRender, QuantityType } from "@bentley/imodeljs-frontend";
import TestUtils from "../TestUtils";
import { QuantityInput } from "../../ui-components/inputs/QuantityInput";
import { SpecialKey } from "@bentley/ui-abstract";

describe("QuantityInput", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;
  function requestNextAnimation() { }

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });
    await TestUtils.initializeUiComponents();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);
  });

  afterEach(cleanup);

  it("should render input for Length", async () => {
    const initialLength = 1;  // 1 meter
    const spyOnChange = sinon.spy();
    const wrapper = render(<QuantityInput initialValue={initialLength} quantityType={QuantityType.Length} onQuantityChange={spyOnChange} />);
    expect(wrapper).not.to.be.undefined;
    const input = await wrapper.findByTestId("components-parsed-input");
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(spyOnChange).not.to.have.been.called;
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    expect(spyOnChange).to.have.been.called;
  });

  it("should process ESC key", async () => {
    const initialLength = 1;  // 1 meter
    const spyOnChange = sinon.spy();

    const wrapper = render(<QuantityInput initialValue={initialLength} quantityType={QuantityType.Length} onQuantityChange={spyOnChange} />);
    expect(wrapper).not.to.be.undefined;

    const input = (await wrapper.findByTestId("components-parsed-input")) as HTMLInputElement;
    const initialValue = input.value;
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: SpecialKey.Escape });
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    expect(spyOnChange).not.to.have.been.called;  // value did not change after ESC was pressed
    const currentValue = input.value;
    expect(initialValue).to.eq(currentValue);

    IModelApp.quantityFormatter.onActiveUnitSystemChanged.emit({ useImperial: true });
  });

  it("should attach 'components-parsed-input-has-error' when bad input", async () => {
    const initialLength = 1;  // 1 meter
    const spyOnChange = sinon.spy();

    const wrapper = render(<QuantityInput initialValue={initialLength} quantityType={QuantityType.Length} onQuantityChange={spyOnChange} />);
    expect(wrapper).not.to.be.undefined;
    const input = (await wrapper.findByTestId("components-parsed-input")) as HTMLInputElement;
    const initialValue = input.value;
    input.focus();
    fireEvent.change(input, { target: { value: "abc" } });
    input.blur();
    await TestUtils.flushAsyncOperations();
    expect(input.classList.contains("components-parsed-input-has-error")).to.be.true;
    fireEvent.keyDown(input, { key: SpecialKey.Escape });
    expect(spyOnChange).not.to.have.been.called;  // value did not change after ESC was pressed
    const currentValue = input.value;
    await TestUtils.flushAsyncOperations();
    expect(input.classList.contains("components-parsed-input-has-error")).to.be.false;
    expect(initialValue).to.eq(currentValue);

  });
});
