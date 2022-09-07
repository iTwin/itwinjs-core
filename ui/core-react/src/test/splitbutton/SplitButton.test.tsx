/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { SplitButton } from "../../core-react";
import { RelativePosition } from "@itwin/appui-abstract";
import { ButtonType } from "../../core-react/button/Button";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<SplitButton />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });
  it("renders correctly", () => {
    render(<SplitButton label="test" />);

    expect(screen.getByText(/test/)).to.exist;
  });

  it("renders with icon correctly", () => {
    render(<SplitButton label="test" icon="icon-placeholder" />);

    expect(classesFromElement(screen.getByText(/test/).firstElementChild)).to.include.members(["icon", "icon-placeholder"]);
  });

  it("renders with drawBorder correctly", () => {
    render(<SplitButton label="test" drawBorder />);

    expect(classesFromElement(screen.getAllByRole("button")[0])).to.include("core-split-button-border");
  });

  it("renders with popupPosition correctly", async () => {
    render(<SplitButton label="test" popupPosition={RelativePosition.BottomLeft} />);

    await theUserTo.click(screen.getAllByRole("button")[2]);
    expect(classesFromElement(screen.getByTestId("core-popup"))).to.include("core-popup-bottom-left");
  });

  ([
    ["Blue", "uicore-buttons-blue"],
    ["Disabled", "uicore-buttons-disabled"],
    ["Hollow", "uicore-buttons-hollow"],
    ["Primary", "uicore-buttons-primary"],
  ] as [keyof typeof ButtonType, string][]).map(([testedType, expectedClass]) => {
    it(`renders with buttonType=${testedType} correctly`, () => {
      render(<SplitButton label="test" buttonType={ButtonType[testedType]} />);

      expect(classesFromElement(screen.getAllByRole("button")[0])).to.include(expectedClass);
    });
  });

  it("handles keydown/up correctly", async () => {
    render(<SplitButton label="test" />);
    expect(screen.queryByTestId("core-popup")).to.be.null;

    await theUserTo.keyboard("[Tab][ArrowDown]");

    expect(screen.getByTestId("core-popup")).to.exist;
  });

  it("calls onExecute on Enter keyup", async () => {
    const spyMethod = sinon.spy();
    render(<SplitButton label="test" onExecute={spyMethod} />);

    await theUserTo.keyboard("[Tab][Enter]");
    spyMethod.calledOnce.should.true;
  });

  it("handles click on arrow correctly", async () => {
    render(<SplitButton label="test" />);
    expect(screen.queryByTestId("core-popup")).to.be.null;

    await theUserTo.click(screen.getAllByRole("button")[2]);
    expect(screen.getByTestId("core-popup")).to.exist;

    await theUserTo.click(screen.getAllByRole("button")[2]);
    expect(screen.queryByTestId("core-popup")).to.be.null;
  });

  it("handles menu close correctly", async () => {
    render(<SplitButton label="test"><div data-testid="menubutton" /></SplitButton>);
    expect(screen.queryByTestId("core-popup")).to.be.null;

    await theUserTo.click(screen.getAllByRole("button")[2]);
    expect(screen.getByTestId("core-popup")).to.exist;

    await theUserTo.click(screen.getByTestId("menubutton"));
    expect(screen.queryByTestId("core-popup")).to.be.null;
  });

  it("handles initialExpanded prop correctly", () => {
    render(<SplitButton label="test" initialExpanded={true} />);
    expect(screen.getByTestId("core-popup")).to.exist;
  });

});
