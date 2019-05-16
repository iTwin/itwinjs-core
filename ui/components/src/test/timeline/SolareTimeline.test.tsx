/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library";
import { expect } from "chai";
import * as sinon from "sinon";
import { SolarTimeline } from "../../ui-components/timeline/SolarTimeline";
import { BaseSolarDataProvider } from "../../ui-components/timeline/BaseSolarDataProvider";
import TestUtils from "../TestUtils";

class TestSolarDataProvider extends BaseSolarDataProvider {
  public playing = false;
  public timeChangeCallbackCalled = false;

  public onTimeChanged = (_time: Date) => {
    this.timeChangeCallbackCalled = true;
  }

  constructor() {
    super();
  }
}

describe("<SolarTimeline />", () => {
  const rafSpy = sinon.spy((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 0);
  });

  before(async () => {
    // need to initialize to get localized strings
    await TestUtils.initializeUiComponents(); // tslint:disable-line:no-floating-promises

    // JSDom used in testing does not provide implementations for requestAnimationFrame/cancelAnimationFrame so add dummy ones here.
    window.requestAnimationFrame = rafSpy;
    window.cancelAnimationFrame = () => { };
  });

  afterEach(() => {
    afterEach(cleanup);
    rafSpy.resetHistory();
  });

  it("should render", async () => {
    const dataProvider = new TestSolarDataProvider();

    const renderedComponent = render(<SolarTimeline dataProvider={dataProvider} />);
    expect(renderedComponent).not.to.be.undefined;
    // renderedComponent.debug();

    // hit play/pause button to start animation
    const playButton = renderedComponent.getByTestId("play-button");
    expect(dataProvider.timeChangeCallbackCalled).to.be.false;
    expect(renderedComponent.container.getElementsByClassName("icon-media-controls-play").length).to.eq(1);

    fireEvent.click(playButton);
    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.timeChangeCallbackCalled).to.be.true;
    expect(renderedComponent.container.getElementsByClassName("icon-media-controls-pause").length).to.eq(1);

    // hit play/pause button to pause animation
    fireEvent.click(playButton);
    expect(renderedComponent.container.getElementsByClassName("icon-media-controls-play").length).to.eq(1);
  });

});
