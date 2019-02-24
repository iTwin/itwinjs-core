/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { ColorSwatch } from "../../ui-components/color/Swatch";
import TestUtils from "../TestUtils";

describe("<ColorSwatch />", () => {
  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<ColorSwatch color="rgba(255,0,0,255)" />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Fire click event to pick color", async () => {
    const spyOnPick = sinon.spy();
    function handleColorPick(color: string): void {
      expect(color).to.be.equal("rgba(255,0,0,255)");
      spyOnPick();
    }

    const renderedComponent = render(<ColorSwatch color="rgba(255,0,0,255)" onColorPick={handleColorPick} />);
    const colorSwatch = renderedComponent.container.firstChild as HTMLElement;
    expect(colorSwatch).not.to.be.null;
    expect(colorSwatch.tagName).to.be.equal("BUTTON");
    fireEvent.click(colorSwatch);
    await TestUtils.flushAsyncOperations();
    expect(spyOnPick.calledOnce).to.be.true;
  });

});
