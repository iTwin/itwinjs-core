/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library";
import { expect } from "chai";
import sinon from "sinon";
import { SaturationPicker } from "../../ui-components/color/SaturationPicker";
import { HSVColor } from "@bentley/imodeljs-common";

describe("<SaturationPicker />", () => {
  const hsv = new HSVColor();
  hsv.h = 30;
  hsv.s = 30;
  hsv.v = 30;

  const satDivStyle: React.CSSProperties = {
    width: `200px`,
    height: `200px`,
  };

  afterEach(cleanup);

  it("picker should render", () => {
    const renderedComponent = render(<div style={satDivStyle}><SaturationPicker hsv={hsv} /></div>);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Use keyboard to change saturation", async () => {
    let index = 0;

    // starting value is 30
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const satValues = [29, 30, 31, 30, 0, 100, 30, 30];
    const vValues = [30, 29, 30, 31, 30, 30, 0, 100];

    const spyOnPick = sinon.spy();

    function handleSaturationChange(newHsv: HSVColor): void {
      expect(newHsv.s).to.be.equal(satValues[index]);
      expect(newHsv.v).to.be.equal(vValues[index]);
      spyOnPick();
    }

    const renderedComponent = render(<div style={satDivStyle}><SaturationPicker hsv={hsv} onSaturationChange={handleSaturationChange} /></div>);
    const sliderDiv = renderedComponent.getByTestId("saturation-region");
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
