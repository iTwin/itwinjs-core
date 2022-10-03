/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { ExpandableBlock } from "@itwin/itwinui-react";
import { ExpandableList } from "../../core-react";
import TestUtils, { classesFromElement } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function blockClasses(titleElement: Element) {
  expect(titleElement.parentElement?.parentElement, "Block class was not found for element").to.exist;
  return classesFromElement(titleElement.parentElement?.parentElement);
}

describe("ExpandableList", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  it("renders correctly", () => {
    const {container} = render(<ExpandableList />);

    expect(container.querySelector(".uicore-expandable-blocks-list")).to.exist;
  });

  it("should support singleExpandOnly & defaultActiveBlock props", () => {
    render(
      <ExpandableList singleExpandOnly={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} >
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} >
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    expect(screen.queryByText("Hello0")).to.be.null;
    expect(blockClasses(screen.getByText("Hello1"))).to.contain("iui-expanded");
  });

  it("should handle block click", async () => {
    const toggleSpy = sinon.spy();
    render(
      <ExpandableList>
        <ExpandableBlock title="Test" isExpanded={true} onToggle={toggleSpy}>
          <div>Hello</div>
        </ExpandableBlock>
      </ExpandableList>);

    await theUserTo.click(screen.getByText("Test"));
    expect(toggleSpy.calledOnce).to.be.true;
  });

  it("should support singleExpandOnly & singleIsCollapsible props", async () => {
    render(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} >
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} >
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    expect(screen.queryByText("Hello0")).to.be.null;
    expect(blockClasses(screen.getByText("Hello1"))).to.contain("iui-expanded");

    await theUserTo.click(screen.getByText("Test0"));

    expect(blockClasses(screen.getByText("Hello0"))).to.contain("iui-expanded");
    expect(blockClasses(screen.getByText("Hello1"))).not.to.contain("iui-expanded");

    await theUserTo.click(screen.getByText("Test0"));

    expect(blockClasses(screen.getByText("Hello0"))).not.to.contain("iui-expanded");
    expect(blockClasses(screen.getByText("Hello1"))).not.to.contain("iui-expanded");
  });

  it("should support changing defaultActiveBlock in update", () => {
    const {rerender} = render(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} >
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} >
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    expect(screen.queryByText("Hello0")).to.be.null;
    expect(blockClasses(screen.getByText("Hello1"))).to.contain("iui-expanded");

    rerender(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={0}>
        <ExpandableBlock title="Test0" isExpanded={true} >
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} >
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    expect(blockClasses(screen.getByText("Hello0"))).to.contain("iui-expanded");
    expect(blockClasses(screen.getByText("Hello1"))).not.to.contain("iui-expanded");

    rerender(
      <ExpandableList singleExpandOnly={true} singleIsCollapsible={true} defaultActiveBlock={1}>
        <ExpandableBlock title="Test0" isExpanded={true} >
          Hello0
        </ExpandableBlock>
        <ExpandableBlock title="Test1" isExpanded={true} >
          Hello1
        </ExpandableBlock>
      </ExpandableList>);

    expect(blockClasses(screen.getByText("Hello0"))).not.to.contain("iui-expanded");
    expect(blockClasses(screen.getByText("Hello1"))).to.contain("iui-expanded");
  });

});
