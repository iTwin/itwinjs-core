/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { SelectableContent } from "../../components-react/selectable-content/SelectableContent";

/* eslint-disable react/display-name */

describe("<SelectableContent />", () => {

  it("lists all given content components in select box", async () => {
    const { getByText, getByTestId, queryAllByText } = render(
      <div data-testid="selectable-content">
        <SelectableContent defaultSelectedContentId={""}>
          {[
            { id: "a", label: "A", render: () => (<div />) },
            { id: "b", label: "B", render: () => (<div />) },
            { id: "c", label: "C", render: () => (<div />) },
          ]}
        </SelectableContent>
      </div>,
    );

    const selectComponent = getByTestId("selectable-content");

    expect(selectComponent).to.not.be.undefined;
    expect(selectComponent).to.not.be.null;

    const componentsSelectableContent = selectComponent.firstElementChild;
    expect(componentsSelectableContent).to.not.be.null;

    const componentsSelectableContentHeader = componentsSelectableContent?.firstElementChild;
    expect(componentsSelectableContentHeader).to.not.be.null.and.to.not.be.undefined;

    const uiCoreReactSelectTop = componentsSelectableContentHeader?.firstElementChild;
    expect(uiCoreReactSelectTop).to.not.be.null.and.to.not.be.undefined;
    expect(uiCoreReactSelectTop?.firstElementChild).to.not.be.null.and.to.not.be.undefined;

    fireEvent.keyDown(uiCoreReactSelectTop!.firstElementChild!, { key: "ArrowDown" });
    await waitFor(() => getByText("B"));
    expect(getByText("C")).to.not.be.undefined;
    expect(queryAllByText("A")).to.have.length(2);
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

  it("changes displayed content based on selected item in select box", async () => {
    const { getByTestId, getByText } = render(
      <div data-testid="selectable-content">
        <SelectableContent defaultSelectedContentId={"a"}>
          {[
            { id: "a", label: "A", render: () => (<div data-testid="a" />) },
            { id: "b", label: "B", render: () => (<div data-testid="b" />) },
            { id: "c", label: "C", render: () => (<div data-testid="c" />) },
          ]}
        </SelectableContent>
      </div>,
    );
    const selectComponent = getByTestId("selectable-content");

    expect(selectComponent).to.not.be.undefined;
    expect(selectComponent).to.not.be.null;

    expect(getByText("A")).not.be.undefined;
    expect(getByTestId("a")).not.be.undefined;

    const componentsSelectableContent = selectComponent.firstElementChild;
    expect(componentsSelectableContent).to.not.be.null;

    const componentsSelectableContentHeader = componentsSelectableContent?.firstElementChild;
    expect(componentsSelectableContentHeader).to.not.be.null.and.to.not.be.undefined;

    const uiCoreReactSelectTop = componentsSelectableContentHeader?.firstElementChild;
    expect(uiCoreReactSelectTop).to.not.be.null.and.to.not.be.undefined;
    expect(uiCoreReactSelectTop?.firstElementChild).to.not.be.null.and.to.not.be.undefined;

    fireEvent.keyDown(uiCoreReactSelectTop!.firstElementChild!, { key: "ArrowDown" });
    await waitFor(() => getByText("B"));
    fireEvent.click(getByText("B"));

    expect(() => getByText("A")).to.throw;
    expect(() => getByTestId("a")).to.throw;
    expect(getByText("B")).to.not.be.undefined;
    expect(getByTestId("b")).to.not.be.undefined;
  });

});
