/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { render, fireEvent } from "@testing-library/react";
import { SelectableContent } from "../../ui-components/selectable-content/SelectableContent";

describe("<SelectableContent />", () => {

  it("lists all given content components in select box", () => {
    const { getByText } = render(
      <SelectableContent defaultSelectedContentId={""}>
        {[
          { id: "a", label: "A", render: () => (<div />) },
          { id: "b", label: "B", render: () => (<div />) },
          { id: "c", label: "C", render: () => (<div />) },
        ]}
      </SelectableContent>,
    );
    expect(getByText("A")).to.not.be.undefined;
    expect(getByText("B")).to.not.be.undefined;
    expect(getByText("C")).to.not.be.undefined;
  });

  it("renders with default selected content", () => {
    const { getByTestId } = render(
      <SelectableContent defaultSelectedContentId={"b"}>
        {[
          { id: "a", label: "A", render: () => (<div data-testid="a" />) },
          { id: "b", label: "B", render: () => (<div data-testid="b" />) },
          { id: "c", label: "C", render: () => (<div data-testid="c" />) },
        ]}
      </SelectableContent>,
    );
    expect(getByTestId("b")).to.not.be.undefined;
  });

  it("renders the first content in children list if `defaultSelectedContentId` doesn't match provided content definitions", () => {
    const { getByTestId } = render(
      <SelectableContent defaultSelectedContentId={"b"}>
        {[
          { id: "a", label: "A", render: () => (<div data-testid="a" />) },
        ]}
      </SelectableContent>,
    );
    expect(getByTestId("a")).to.not.be.undefined;
  });

  it("renders without content when provided an empty children list", () => {
    const { container } = render(
      <SelectableContent defaultSelectedContentId={""}>
        {[]}
      </SelectableContent>,
    );
    expect(container.getElementsByClassName("components-selectable-content-wrapper")[0].innerHTML).to.be.empty;
  });

  it("changes displayed content based on selected item in select box", () => {
    const { getByDisplayValue } = render(
      <SelectableContent defaultSelectedContentId={"a"}>
        {[
          { id: "a", label: "A", render: () => (<div data-testid="a" />) },
          { id: "b", label: "B", render: () => (<div data-testid="b" />) },
          { id: "c", label: "C", render: () => (<div data-testid="c" />) },
        ]}
      </SelectableContent>,
    );
    const selectBox = getByDisplayValue("A");
    fireEvent.change(selectBox, {
      target: { value: "c" },
    });
    expect(() => getByDisplayValue("A")).to.throw;
    expect(getByDisplayValue("C")).to.not.be.undefined;
  });

});
