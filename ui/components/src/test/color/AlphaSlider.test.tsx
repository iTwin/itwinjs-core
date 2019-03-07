/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { AlphaSlider } from "../../ui-components/color/AlphaSlider";

describe("<AlphaSlider />", () => {
  const alpha = .50;
  const alphaDivStyle: React.CSSProperties = {
    height: `120px`,
  };

  afterEach(cleanup);

  it("horizontal slider should render", () => {
    const renderedComponent = render(<AlphaSlider alpha={alpha} isHorizontal={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("vertical slider should render", () => {
    const renderedComponent = render(<div style={alphaDivStyle}><AlphaSlider alpha={alpha} isHorizontal={false} /></div>);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Use keyboard to pick Transparency - Horizontal", async () => {
    let index = 0;

    // starting value is .5
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [.45, .45, .55, .55, 0, 1, .25, .75];

    const spyOnPick = sinon.spy();
    function handleAlphaChange(_transparency: number): void {
      expect(_transparency).to.be.equal(values[index]);
      spyOnPick();
    }

    const renderedComponent = render(<AlphaSlider alpha={alpha} onAlphaChange={handleAlphaChange} isHorizontal={true} />);
    const sliderDiv = renderedComponent.getByTestId("alpha-slider");
    expect(sliderDiv).not.to.be.null;
    expect(sliderDiv.tagName).to.be.equal("DIV");

    keys.forEach((keyName) => {
      fireEvent.keyDown(sliderDiv, { key: keyName });
      expect(spyOnPick.calledOnce).to.be.true;
      spyOnPick.resetHistory();
      index = index + 1;
    });
  });

  it("Use keyboard to pick Alpha - Vertical", async () => {
    let index = 0;

    // starting value is .5
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [.45, .45, .55, .55, 0, 1, .25, .75];

    const spyOnPick = sinon.spy();
    function handleAlphaChange(_transparency: number): void {
      expect(_transparency).to.be.equal(values[index]);
      spyOnPick();
    }

    const renderedComponent = render(<div style={alphaDivStyle}><AlphaSlider alpha={alpha} onAlphaChange={handleAlphaChange} isHorizontal={false} /></div>);
    const sliderDiv = renderedComponent.getByTestId("alpha-slider");
    expect(sliderDiv).not.to.be.null;
    expect(sliderDiv.tagName).to.be.equal("DIV");

    keys.forEach((keyName) => {
      fireEvent.keyDown(sliderDiv, { key: keyName });
      expect(spyOnPick.calledOnce).to.be.true;
      spyOnPick.resetHistory();
      index = index + 1;
    });
  });

});
