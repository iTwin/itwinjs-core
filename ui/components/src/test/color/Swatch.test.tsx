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
import { ColorDef } from "@bentley/imodeljs-common";

describe("<ColorSwatch />", () => {
  const colorDef = ColorDef.from(255, 0, 0, 255);

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<ColorSwatch colorDef={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("should render rounded", () => {
    const renderedComponent = render(<ColorSwatch colorDef={colorDef} round={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Fire click event to pick color", async () => {
    const spyOnPick = sinon.spy();
    function handleColorPick(color: ColorDef): void {
      expect(color.equals(colorDef)).to.be.true;
      spyOnPick();
    }

    const renderedComponent = render(<ColorSwatch colorDef={colorDef} onColorPick={handleColorPick} />);
    const colorSwatch = renderedComponent.container.firstChild as HTMLElement;
    expect(colorSwatch).not.to.be.null;
    expect(colorSwatch.tagName).to.be.equal("BUTTON");
    fireEvent.click(colorSwatch);
    await TestUtils.flushAsyncOperations();
    expect(spyOnPick.calledOnce).to.be.true;
  });

});
