/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { ExpansionToggle } from "../../core-react";
import TestUtils, { classesFromElement } from "../TestUtils";

describe("<ExpansionToggle />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  it("renders collapsed correctly", () => {
    render(<ExpansionToggle />);

    expect(classesFromElement(screen.getByRole("button"))).to.include("core-tree-expansionToggle");
    expect(screen.getByLabelText("tree.expand")).to.exist;
  });

  it("should render expanded", () => {
    render(<ExpansionToggle isExpanded />);

    expect(classesFromElement(screen.getByRole("button"))).to.include("is-expanded");
    expect(screen.getByLabelText("tree.collapse")).to.exist;
  });

  it("should handle click events", async () => {
    const handler = sinon.spy();
    render(<ExpansionToggle onClick={handler} />);

    await theUserTo.click(screen.getByRole("button"));
    handler.calledOnce.should.true;
  });
});
