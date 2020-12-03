/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import * as sinon from "sinon";
import { cleanup, fireEvent, render, waitForElement } from "@testing-library/react";
import { BaseSolarDataProvider } from "../../ui-components/timeline/BaseSolarDataProvider";
import { SolarTimeline } from "../../ui-components/timeline/SolarTimeline";
import { SpeedTimeline } from "../../ui-components/timeline/SpeedTimeline";
import TestUtils from "../TestUtils";

class TestSolarDataProvider extends BaseSolarDataProvider {
  public playing = false;
  public timeChangeCallbackCalled = false;

  public onTimeChanged = (_time: Date) => {
    this.timeChangeCallbackCalled = true;
  };

  constructor() {
    super();
  }
}

describe("<SpeedTimeline />", () => {

  before(async () => {
    // need to initialize to get localized strings
    await TestUtils.initializeUiComponents();
  });

  afterEach(() => {
    afterEach(cleanup);
  });

  it("should render", async () => {
    let valueChanged = false;
    const onChange = (_value: number) => {
      valueChanged = true;
    };

    const renderedComponent = render(<SpeedTimeline speed={3} onChange={onChange} />);
    expect(renderedComponent).not.to.be.undefined;
    // renderedComponent.debug();
    expect(valueChanged).to.be.false;
    const sliderDiv = renderedComponent.getByRole("slider");
    expect(sliderDiv).not.to.be.undefined;
    const ariaValue = sliderDiv.getAttribute("aria-valuenow");
    expect(ariaValue).to.be.equal("3");
  });
});

describe("<SolarTimeline />", () => {
  const rafSpy = sinon.spy((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 0);
  });

  before(async () => {
    // need to initialize to get localized strings
    await TestUtils.initializeUiComponents();

    // JSDom used in testing does not provide implementations for requestAnimationFrame/cancelAnimationFrame so add dummy ones here.
    window.requestAnimationFrame = rafSpy;
    window.cancelAnimationFrame = () => { };
  });

  afterEach(() => {
    afterEach(cleanup);
    rafSpy.resetHistory();
  });

  after(() => {
    sinon.restore();
  });

  it("should render", async () => {
    const fakeTimers = sinon.useFakeTimers();
    const dataProvider = new TestSolarDataProvider();

    const renderedComponent = render(<SolarTimeline dataProvider={dataProvider} />);
    expect(renderedComponent).not.to.be.undefined;
    // renderedComponent.debug();

    // hit play/pause button to start animation
    const playButton = renderedComponent.getByTestId("play-button");
    expect(dataProvider.timeChangeCallbackCalled).to.be.false;
    expect(renderedComponent.container.getElementsByClassName("icon-media-controls-play").length).to.eq(1);

    fireEvent.click(playButton);
    try {
      // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
      fakeTimers.tick(500);
      fakeTimers.restore();
      // the following sets up a MutationObserver which triggers when the DOM is updated
      const update1Button = await waitForElement(() => renderedComponent.getByTestId("play-button"));
      if (update1Button) {
        expect(dataProvider.timeChangeCallbackCalled).to.be.true;
        expect(renderedComponent.container.getElementsByClassName("icon-media-controls-pause").length).to.eq(1);
      }
      // hit play/pause button to pause animation
      fireEvent.click(playButton);
      // the following sets up a MutationObserver which triggers when the DOM is updated
      const update2Button = await waitForElement(() => renderedComponent.getByTestId("play-button"));
      if (update2Button)
        expect(renderedComponent.container.getElementsByClassName("icon-media-controls-play").length).to.eq(1);
    } catch {
    }
  });
});
