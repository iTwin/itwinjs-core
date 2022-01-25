/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { ColorDef } from "@itwin/core-common";
import { fireEvent, render } from "@testing-library/react"; // , waitForElement
import { ColorSwatch } from "../../imodel-components-react/color/Swatch";
import { TestUtils } from "../TestUtils";

describe("<ColorSwatch />", () => {
  const colorDef = ColorDef.from(255, 0, 0, 255);

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
