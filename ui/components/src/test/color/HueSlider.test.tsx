/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { HueSlider } from "../../ui-components/color/HueSlider";
import { HSVColor } from "@bentley/imodeljs-common";

describe("<HueSlider />", () => {
  const hsv = new HSVColor();
  hsv.h = 60;
  hsv.s = 100;
  hsv.v = 50;

  afterEach(cleanup);

  it("horizontal slider should render", () => {
    const renderedComponent = render(<HueSlider hsv={hsv} isHorizontal={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("vertical slider should render", () => {
    const hueDivStyle: React.CSSProperties = {
      height: `120px`,
    };

    const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} isHorizontal={false} /></div>);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Use keyboard to pick hue", async () => {
    let index = 0;

    // starting value is 60
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [59, 59, 61, 61, 0, 360, 0, 120];

    const spyOnPick = sinon.spy();
    function handleHueChange(newColor: HSVColor): void {
      expect(newColor.h).to.be.equal(values[index]);
      spyOnPick();
    }

    const renderedComponent = render(<HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={true} />);
    const sliderDiv = renderedComponent.getByTestId("hue-slider");
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
