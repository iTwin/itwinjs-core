/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { TransparencySlider } from "../../ui-components/color/TransparencySlider";

describe("<TransparencySlider />", () => {
  const transparency = .50;
  const transparencyDivStyle: React.CSSProperties = {
    height: `120px`,
  };

  afterEach(cleanup);

  it("horizontal slider should render", () => {
    const renderedComponent = render(<TransparencySlider transparency={transparency} isHorizontal={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("vertical slider should render", () => {
    const renderedComponent = render(<div style={transparencyDivStyle}><TransparencySlider transparency={transparency} isHorizontal={false} /></div>);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Use keyboard to pick Transparency - Horizontal", async () => {
    let index = 0;

    // starting value is .5
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [.45, .45, .55, .55, 0, 1, .25, .75];

    const spyOnPick = sinon.spy();
    function handleTransparencyChange(_transparency: number): void {
      expect(_transparency).to.be.equal(values[index]);
      spyOnPick();
    }

    const renderedComponent = render(<TransparencySlider transparency={transparency} onTransparencyChange={handleTransparencyChange} isHorizontal={true} />);
    const sliderDiv = renderedComponent.getByTestId("transparency-slider");
    expect(sliderDiv).not.to.be.null;
    expect(sliderDiv.tagName).to.be.equal("DIV");

    keys.forEach((keyName) => {
      fireEvent.keyDown(sliderDiv, { key: keyName });
      expect(spyOnPick.calledOnce).to.be.true;
      spyOnPick.resetHistory();
      index = index + 1;
    });
  });

  it("Use keyboard to pick Transparency - Vertical", async () => {
    let index = 0;

    // starting value is .5
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [.45, .45, .55, .55, 0, 1, .25, .75];

    const spyOnPick = sinon.spy();
    function handleTransparencyChange(_transparency: number): void {
      expect(_transparency).to.be.equal(values[index]);
      spyOnPick();
    }

    const renderedComponent = render(<div style={transparencyDivStyle}><TransparencySlider transparency={transparency} onTransparencyChange={handleTransparencyChange} isHorizontal={false} /></div>);
    const sliderDiv = renderedComponent.getByTestId("transparency-slider");
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
