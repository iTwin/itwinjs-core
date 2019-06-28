/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "@testing-library/react"; // , waitForElement
import { expect } from "chai";
import sinon from "sinon";
import { HueSlider } from "../../ui-components/color/HueSlider";
import { HSVColor } from "@bentley/imodeljs-common";

describe("<HueSlider />", () => {
  const hsv = new HSVColor();
  hsv.h = 60;
  hsv.s = 100;
  hsv.v = 50;

  const createBubbledEvent = (type: string, props = {}) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, props);
    return event;
  };

  const hueDivStyle: React.CSSProperties = {
    height: `120px`,
  };

  afterEach(cleanup);

  it("horizontal slider should render", () => {
    const renderedComponent = render(<HueSlider hsv={hsv} isHorizontal={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("vertical slider should render", () => {
    const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} isHorizontal={false} /></div>);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("Use keyboard to pick hue", async () => {
    let index = 0;

    // starting value is 60
    const keys = ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    const values = [59, 59, 61, 61, 0, 360, 0, 120, 50, 50, 70, 70, 0, 360, 0, 240];

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

    keys.forEach((keyName) => {
      fireEvent.keyDown(sliderDiv, { key: keyName, ctrlKey: true });
      expect(spyOnPick.calledOnce).to.be.true;
      spyOnPick.resetHistory();
      index = index + 1;
    });
  });

  describe("using mouse location - horizontal ", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    // force getBoundingClientRect to return info we need during testing
    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 30,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 200,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("point @0,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(0);
      }

      const renderedComponent = render(<HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={true} />);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("mousedown", { pageX: 0, pageY: 0 }));
      sliderDiv.dispatchEvent(createBubbledEvent("mouseup", { pageX: 0, pageY: 0 }));
    });

    it("point @200,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(360);
      }

      const renderedComponent = render(<HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={true} />);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("mousedown", { pageX: 200, pageY: 0 }));
      sliderDiv.dispatchEvent(createBubbledEvent("mouseup", { pageX: 200, pageY: 0 }));
    });

  });

  describe("using touch location - horizontal", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    // force getBoundingClientRect to return info we need during testing
    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 30,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 200,
        x: 0,
        y: 0,
      });

    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("point @0,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(0);
      }

      const renderedComponent = render(<HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={true} />);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("touchstart", { touches: [{ pageX: 0, pageY: 0 }] }));
      sliderDiv.dispatchEvent(createBubbledEvent("touchend", { touches: [{ pageX: 0, pageY: 0 }] }));
    });

    it("point @200,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(360);
      }

      const renderedComponent = render(<HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={true} />);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("touchstart", { touches: [{ pageX: 200, pageY: 0 }] }));
      sliderDiv.dispatchEvent(createBubbledEvent("touchend", { touches: [{ pageX: 200, pageY: 0 }] }));
    });
  });

  describe("using mouse location - vertical ", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    // force getBoundingClientRect to return info we need during testing
    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 200,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 30,
        x: 0,
        y: 0,
      });
    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("point @0,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(360);
      }

      const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={false} /></div>);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("mousedown", { pageX: 0, pageY: 0 }));
      sliderDiv.dispatchEvent(createBubbledEvent("mouseup", { pageX: 0, pageY: 0 }));
    });

    it("point @0,200", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(0);
      }

      const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={false} /></div>);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("mousedown", { pageX: 0, pageY: 200 }));
      sliderDiv.dispatchEvent(createBubbledEvent("mouseup", { pageX: 0, pageY: 200 }));
    });

  });

  describe("using touch location - vertical", () => {
    const getBoundingClientRect = Element.prototype.getBoundingClientRect;

    // force getBoundingClientRect to return info we need during testing
    before(() => {
      Element.prototype.getBoundingClientRect = () => ({
        bottom: 0,
        height: 200,
        left: 0,
        right: 0,
        toJSON: () => { },
        top: 0,
        width: 30,
        x: 0,
        y: 0,
      });

    });

    after(() => {
      Element.prototype.getBoundingClientRect = getBoundingClientRect;
    });

    it("point @0,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(360);
      }

      const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={false} /></div>);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("touchstart", { touches: [{ pageX: 0, pageY: 0 }] }));
      sliderDiv.dispatchEvent(createBubbledEvent("touchend", { touches: [{ pageX: 0, pageY: 0 }] }));
    });

    it("point @200,0", () => {
      function handleHueChange(newColor: HSVColor): void {
        expect(newColor.h).to.be.equal(0);
      }

      const renderedComponent = render(<div style={hueDivStyle}><HueSlider hsv={hsv} onHueChange={handleHueChange} isHorizontal={false} /></div>);
      const sliderDiv = renderedComponent.getByTestId("hue-slider");
      sliderDiv.dispatchEvent(createBubbledEvent("touchstart", { touches: [{ pageX: 0, pageY: 200 }] }));
      sliderDiv.dispatchEvent(createBubbledEvent("touchend", { touches: [{ pageX: 0, pageY: 200 }] }));
    });
  });
});
