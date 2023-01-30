/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import sinon from "sinon";
import { PropertyDescription, PropertyValueFormat } from "@itwin/appui-abstract";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { PropertyFilterBuilderRuleValue } from "../../components-react/filter-builder/FilterBuilderRuleValue";
import TestUtils from "../TestUtils";

describe("PropertyFilterBuilderRuleValue", () => {
  const defaultProperty: PropertyDescription = {
    name: "prop",
    displayLabel: "Prop",
    typename: "string",
  };

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("renders string value", async () => {
    const { getByDisplayValue } = render(<PropertyFilterBuilderRuleValue
      value={{ valueFormat: PropertyValueFormat.Primitive, value: "Test String" }}
      property={defaultProperty}
      onChange={() => { }}
    />);
    await waitFor(() => getByDisplayValue("Test String"));
  });

  it("renders empty value", () => {
    const { container } = render(<PropertyFilterBuilderRuleValue
      property={defaultProperty}
      onChange={() => { }}
    />);

    const input = container.querySelector<HTMLInputElement>(".iui-input");
    expect(input).to.not.be.null;

    expect(input?.value).to.be.empty;
  });

  it("calls onChange when value is changed", async () => {
    const spy = sinon.spy();
    const { container, getByDisplayValue } = render(<PropertyFilterBuilderRuleValue
      property={defaultProperty}
      onChange={spy}
    />);

    const input = container.querySelector<HTMLInputElement>(".iui-input");
    expect(input).to.not.be.null;

    act(() => { fireEvent.change(input!, { target: { value: "test text" } }); });
    act(() => { fireEvent.focusOut(input!); });

    await waitFor(() => getByDisplayValue("test text"));

    expect(spy).to.be.calledOnceWith({ valueFormat: PropertyValueFormat.Primitive, value: "test text", displayValue: "" });
  });
});
