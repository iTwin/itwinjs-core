/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TreeNode as Node } from "../../core-react";
import { CheckBoxState } from "../../core-react/enums/CheckBoxState";
import { classesFromElement } from "../TestUtils";

describe("<Node />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  it("renders correctly", () => {
    render(<Node label="a" level={0} />);

    expect(classesFromElement(screen.getByRole("button"))).to.include.members(["expansion-toggle","core-tree-expansionToggle"]).and.not.include("is-expanded");
  });

  it("should set is-focused class", () => {
    render(<Node label="a" level={0} isFocused />);

    expect(classesFromElement(screen.getByRole("treeitem"))).to.include("is-focused");
  });

  it("should set is-selected class", () => {
    render(<Node label="a" level={0} isSelected />);

    expect(classesFromElement(screen.getByRole("treeitem"))).to.include("is-selected");
  });

  it("should set is-hover-disabled class", () => {
    render(<Node label="a" level={0} isHoverDisabled />);

    expect(classesFromElement(screen.getByRole("treeitem"))).to.include("is-hover-disabled");
  });

  it("renders label correctly", () => {
    render(<Node level={0} label={<span>Test label</span>} />);

    expect(screen.getByText("Test label", {selector: ".contents span"})).to.exist;
  });

  it("renders icon correctly", () => {
    render(<Node label="a" level={0} icon={<i data-testid={"test-icon"} />} />);

    expect(screen.getByTestId("test-icon").matches(".contents > .core-tree-node-icon > i")).to.be.true;
  });

  it("renders loader correctly", () => {
    const {container} = render(<Node label="a" level={0} isLoading />);

    expect(container.querySelector(".iui-indeterminate.iui-x-small")).to.exist;
  });

  it("render leaf correctly", () => {
    render(<Node label="a" level={0} isLeaf={true} data-testid={"a"}/>);

    expect(screen.queryByRole("button")).to.be.null;
    expect(screen.getByTestId<HTMLDivElement>("a-contents").style).to.include({marginLeft: "24px"});
  });

  it("render expanded correctly", () => {
    render(<Node label="a" level={0} isExpanded={true} />);

    expect(classesFromElement(screen.getByRole("button"))).to.include.members(["expansion-toggle","core-tree-expansionToggle", "is-expanded"]);
  });

  it("render expanded leaf correctly", () => {
    render(<Node label="a" level={0} isExpanded={true} isLeaf={true} data-testid={"a"}/>);

    expect(screen.queryByRole("button")).to.be.null;
    expect(screen.getByTestId<HTMLDivElement>("a-contents").style).to.include({marginLeft: "24px"});
  });

  it("renders children correctly", () => {
    render(<Node label="a" level={0}><div className="unique">Test Children</div></Node>);

    expect(screen.getByText("Test Children", {selector: "div.core-tree-node > div"})).to.exist;
  });

  it("renders checkbox correctly", () => {
    render(<Node label="a" level={0} checkboxProps={{ state: CheckBoxState.On }} />);

    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).to.be.true;
  });

  it("renders checkbox using render override if specified", () => {
    const ovr = sinon.stub().returns(<div data-testid="custom-checkbox" />);
    render(<Node label="a" level={0} checkboxProps={{ state: CheckBoxState.On }} renderOverrides={{ renderCheckbox: ovr }} />);
    ovr.should.be.calledWithMatch({checked: true});
    expect(screen.getByTestId("custom-checkbox")).to.exist;
  });

  it("should call onClick callback when node is clicked", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} onClick={callback} />);

    await theUserTo.click(screen.getByRole("treeitem"));
    expect(callback).to.be.calledOnce;
  });

  it("should call onClickExpansionToggle callback when expansion toggle is clicked", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} onClickExpansionToggle={callback} data-testid="a"/>);

    await theUserTo.click(screen.getByTestId("a-expansion-toggle"));
    expect(callback).to.be.calledOnce;
  });

  it("should not call onClick callback when expansion toggle is clicked", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} onClick={callback} data-testid="a"/>);

    await theUserTo.click(screen.getByTestId("a-expansion-toggle"));
    expect(callback).to.not.be.called;
  });

  it("should call checkboxProps.onClick callback when checkbox state changes with On", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} checkboxProps={{ onClick: callback, state: CheckBoxState.On }} data-testid="a"/>);

    await theUserTo.click(screen.getByTestId("a-checkbox"));
    expect(callback).to.be.calledOnceWith(CheckBoxState.Off);
  });

  it("should call checkboxProps.onClick callback when checkbox state changes with Off", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} checkboxProps={{ onClick: callback, state: CheckBoxState.Off }} data-testid="a"/>);

    await theUserTo.click(screen.getByTestId("a-checkbox"));
    expect(callback).to.be.calledOnceWith(CheckBoxState.On);
  });

  it("should not call checkboxProps.onClick callback when checkbox is disabled", async () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} checkboxProps={{ onClick: callback, isDisabled: true }} data-testid="a"/>);

    await theUserTo.click(screen.getByTestId("a-checkbox"));
    expect(callback).to.not.be.called;
  });

  it("does not call node onClick callback when checkbox is clicked", async () => {
    const handleOnClick = sinon.fake();
    render(<Node label="a" level={0} onClick={handleOnClick} checkboxProps={{}} />);

    await userEvent.click(screen.getByRole("checkbox"));
    expect(handleOnClick).to.not.have.been.called;
  });

  it("should still stop propagation with undefined handlers", async () => {
    const spy = sinon.spy();
    render(<button onClick={spy}><Node label="a" level={0} data-testid="a" /></button>);

    await theUserTo.click(screen.getByRole("treeitem"));
    await theUserTo.click(screen.getByTestId("a-expansion-toggle"));
    expect(spy).not.to.have.been.called;
  });

  it("sets data-testid", () => {
    render(<Node label="a" level={0} data-testid="test" />);
    expect(screen.getByTestId("test")).to.exist;
    expect(screen.getByTestId("test-expansion-toggle")).to.exist;
    expect(screen.getByTestId("test-contents")).to.exist;
  });

  it("should call onContextMenu callback when node is right-clicked", () => {
    const callback = sinon.spy();
    render(<Node label="a" level={0} onContextMenu={callback} />);

    fireEvent.contextMenu(screen.getByRole("treeitem"));
    expect(callback).to.be.calledOnce;
  });
});
