/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import type { AnalysisStyle } from "@itwin/core-common";
import type { ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { AnalysisAnimationTimelineDataProvider } from "../../appui-react/timeline/AnalysisAnimationProvider";

describe("AnalysisAnimationTimelineDataProvider", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const analysisMock = moq.Mock.ofType<AnalysisStyle>();

  beforeEach(() => {
    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SpatialViewDefinition");
    viewMock.setup((view) => view.analysisStyle).returns(() => analysisMock.object);
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
    viewportMock.setup((viewport) => viewport.analysisFraction).returns(() => 0.3);
  });

  it("AnalysisAnimationTimelineDataProvider can provide timeline data", async () => {
    const viewState = viewMock.object;
    const viewport = viewportMock.object;

    const provider = new AnalysisAnimationTimelineDataProvider(viewState, viewport);
    expect(provider).not.to.be.null;
    expect(provider.supportsTimelineAnimation).to.be.true;

    const dataLoaded = await provider.loadTimelineData();
    expect(dataLoaded).to.be.true;

    expect(dataLoaded).to.be.true;
    expect(provider.animationFraction).to.be.equal(0.3);

    // clear out viewport since next call will try to write to viewport.animationFraction and I can't see a way to moq the writing of a property
    provider.viewport = undefined;
    provider.onAnimationFractionChanged(0.5);
    expect(provider.animationFraction).to.be.equal(0.5);
  });

});
