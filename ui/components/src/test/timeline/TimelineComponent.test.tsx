/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import * as sinon from "sinon";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { BaseTimelineDataProvider } from "../../ui-components/timeline/BaseTimelineDataProvider";
import { Milestone, PlaybackSettings, TimelinePausePlayAction, TimelinePausePlayArgs } from "../../ui-components/timeline/interfaces";
import { TimelineComponent } from "../../ui-components/timeline/TimelineComponent";
import TestUtils from "../TestUtils";
import { UiAdmin } from "@bentley/ui-abstract";

class TestTimelineDataProvider extends BaseTimelineDataProvider {
  public playing = false;
  public pointerCallbackCalled = false;
  public settingsCallbackCalled = false;
  public forwardCallbackCalled = false;
  public backwardCallbackCalled = false;

  public onAnimationFractionChanged = (animationFraction: number) => {
    this.pointerCallbackCalled = true;
    this.animationFraction = animationFraction;
  };

  public onJump = (forward: boolean) => {
    this.forwardCallbackCalled = forward;
    this.backwardCallbackCalled = !forward;
  };

  public onPlaybackSettingChanged = (settings: PlaybackSettings) => {
    this.settingsCallbackCalled = true;
    this.updateSettings(settings);
  };

  public onPlayPause = (playing: boolean) => {
    this.playing = playing;
  };

  constructor(addMilestones: boolean) {
    super();

    this.animationFraction = 0.3;
    const duration = 20 * 1000;
    const loop = false;
    const startDate = new Date(2014, 6, 6);
    const endDate = new Date(2016, 8, 12);

    const milestones: Milestone[] = [
      { id: "1", date: new Date(2014, 6, 15), label: "First meeting", readonly: true },
      { id: "2", date: new Date(2014, 8, 15), label: "meeting 2", readonly: true },
      { id: "3", date: new Date(2014, 10, 15), label: "meeting 3", readonly: true },
      { id: "4", date: new Date(2014, 12, 15), label: "meeting 4", readonly: true },
      { id: "5", date: new Date(2015, 2, 15), label: "meeting 5", readonly: true },
      { id: "6", date: new Date(2015, 4, 15), label: "meeting 6", readonly: true },
      { id: "7", date: new Date(2015, 6, 15), label: "meeting 7", readonly: false },
      { id: "8", date: new Date(2015, 8, 15), label: "meeting 8", readonly: false },
      { id: "9", date: new Date(2015, 10, 15), label: "meeting 9", readonly: false },
      { id: "10", date: new Date(2015, 12, 15), label: "meeting 10", readonly: false },
      { id: "11", date: new Date(2016, 2, 15), label: "meeting 11" },
      {
        id: "12", date: new Date(2016, 4, 15), label: "meeting 12", readonly: true, children: [
          { id: "12-1", date: new Date(2016, 4, 17), label: "meeting 12a", readonly: true, parentId: "12" },
          { id: "12-2", date: new Date(2016, 4, 18), label: "meeting 12b", readonly: true, parentId: "12" },
        ],
      },
      { id: "13", date: new Date(2016, 6, 15), label: "Last meeting" },
    ];

    this.updateSettings({
      duration,
      loop,
    });

    this.start = startDate;
    this.end = endDate;

    if (addMilestones) {
      this._milestones = milestones;
    }
  }
}

function TestRepeatTimelineComponent() {
  const duration = 20 * 1000;
  const startDate = new Date(2014, 6, 6);
  const endDate = new Date(2016, 8, 12);
  const [loop, setLoop] = React.useState <boolean> (false);

  const handleOnSettingsChange = (settings: PlaybackSettings) => {
    if (settings.loop !== undefined) {
      setLoop(settings.loop);
    }
  };

  return (
    <div>
      <TimelineComponent
        startDate={startDate}
        endDate={endDate}
        initialDuration={0}
        totalDuration={duration}
        minimized={true}
        showDuration={true}
        alwaysMinimized={true}
        repeat={loop}
        onSettingsChange={handleOnSettingsChange}
        componentId={"testApp-testRepeatTimeline"} // qualify id with "<appName>-" to ensure uniqueness
      />
    </div>
  );
}

describe("<TimelineComponent showDuration={true} />", () => {
  let fakeTimers: sinon.SinonFakeTimers | undefined;
  const rafSpy = sinon.spy((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 0);
  });

  before(async () => {
    sinon.restore();
    // need to initialize to get localized strings
    await TestUtils.initializeUiComponents();

    // JSDom used in testing does not provide implementations for requestAnimationFrame/cancelAnimationFrame so add dummy ones here.
    window.requestAnimationFrame = rafSpy;
    window.cancelAnimationFrame = () => { };
  });

  afterEach(() => {
    fakeTimers && fakeTimers.restore();
    afterEach(cleanup);
    rafSpy.resetHistory();
  });

  after(() => {
    sinon.restore();
  });

  it("should render without milestones - minimized", async () => {
    const dataProvider = new TestTimelineDataProvider(false);
    expect(dataProvider.loop).to.be.false;
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={true}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onSettingsChange={dataProvider.onPlaybackSettingChanged}
      onPlayPause={dataProvider.onPlayPause} />);

    expect(renderedComponent).not.to.be.undefined;
    // renderedComponent.debug();

    // hit play/pause button to start animation
    const playButton = renderedComponent.getAllByTestId("play-button")[0];
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.true;

    // hit play/pause button to pause animation
    fireEvent.click(playButton);
    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.true;
  });

  it("should render with milestones - minimized", async () => {
    const dataProvider = new TestTimelineDataProvider(true);
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={true}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onPlayPause={dataProvider.onPlayPause} />);

    expect(renderedComponent).not.to.be.undefined;
    // hit play/pause button to start animation
    const playButtons = renderedComponent.getAllByTestId("play-button");
    const playButton = playButtons[playButtons.length - 1];
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.true;

    // hit play/pause button to pause animation
    fireEvent.click(playButton);
    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.true;
  });

  it("should render without milestones - expanded", async () => {
    const dataProvider = new TestTimelineDataProvider(false);

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={false}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onPlayPause={dataProvider.onPlayPause} />);

    expect(renderedComponent).not.to.be.undefined;
  });

  it("should render with milestones - expanded", async () => {
    const dataProvider = new TestTimelineDataProvider(true);
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={false}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      onPlayPause={dataProvider.onPlayPause} />);

    expect(renderedComponent).not.to.be.undefined;
    // hit play/pause button to start animation
    const jumpForwardButton = renderedComponent.getByTestId("play-forward");
    expect(dataProvider.forwardCallbackCalled).to.be.false;
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(jumpForwardButton);

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.forwardCallbackCalled).to.be.true;

    const jumpBackwardButton = renderedComponent.getByTestId("play-backward");
    expect(dataProvider.backwardCallbackCalled).to.be.false;
    fireEvent.click(jumpBackwardButton);

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.backwardCallbackCalled).to.be.true;
  });

  it("timeline with short duration - expanded", async () => {
    const dataProvider = new TestTimelineDataProvider(true);
    dataProvider.getSettings().duration = 20;  // make sure this is shorter than 40 so we get to end of animation

    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={false}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      onPlayPause={dataProvider.onPlayPause} />);

    // hit play/pause button to start animation
    const playButtons = renderedComponent.getAllByTestId("play-button");
    const playButton = playButtons[0];
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.true;

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.false;
  });

  it("timeline with short duration (repeat animation loop) - expanded", async () => {
    const dataProvider = new TestTimelineDataProvider(true);
    dataProvider.getSettings().duration = 30;  // make sure this is shorter than 40 so we get to end of animation
    dataProvider.getSettings().loop = true;
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={false}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      repeat={dataProvider.getSettings().loop}
      onPlayPause={dataProvider.onPlayPause} />);

    // hit play/pause button to start animation
    const playButtons = renderedComponent.getAllByTestId("play-button");
    const playButton = playButtons[0];
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.true;

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.true;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.false;
  });

  it("timeline with short duration (repeat set and at end of animation loop) - expanded", async () => {
    const dataProvider = new TestTimelineDataProvider(true);
    dataProvider.getSettings().duration = 30;  // make sure this is shorter than 40 so we get to end of animation
    dataProvider.getSettings().loop = true;
    dataProvider.animationFraction = 1.0;
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={false}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      repeat={dataProvider.getSettings().loop}
      onPlayPause={dataProvider.onPlayPause} />);

    // hit play/pause button to start animation
    const playButton = renderedComponent.getAllByTestId("play-button")[0];
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.true;

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.true;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.false;
  });

  it("timeline with no dates (Analysis animation", async () => {
    const dataProvider = new TestTimelineDataProvider(false);
    dataProvider.getSettings().duration = 30;  // make sure this is shorter than the timeout of 40 so we get to end of animation
    fakeTimers = sinon.useFakeTimers();

    const renderedComponent = render(<TimelineComponent
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      minimized={true}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      onPlayPause={dataProvider.onPlayPause} />);

    // hit play/pause button to start animation
    const playButtons = renderedComponent.getAllByTestId("play-button");
    const playButton = playButtons[playButtons.length - 1]; // last play button is the one in the scrubber.
    expect(dataProvider.playing).to.be.false;
    expect(dataProvider.pointerCallbackCalled).to.be.false;

    fireEvent.click(playButton);
    expect(dataProvider.playing).to.be.true;

    // Wait for animation.
    fakeTimers.tick(600);
    // Wait for 1st raf cb.
    fakeTimers.tick(1);

    // kill some time to wait for setState and subsequent call to window.requestAnimationFrame to process
    // await new Promise((r) => { setTimeout(r, 40); });
    expect(dataProvider.playing).to.be.false;
  });

  it("open/close timeline settings - minimized", async () => {
    const dataProvider = new TestTimelineDataProvider(false);

    const renderedComponent = render(<TimelineComponent
      startDate={dataProvider.start}
      endDate={dataProvider.end}
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      milestones={dataProvider.getMilestones()}
      minimized={true}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onSettingsChange={dataProvider.onPlaybackSettingChanged}
      onPlayPause={dataProvider.onPlayPause} />);

    expect(renderedComponent).not.to.be.undefined;

    // hit play/pause button to start animation
    const settingMenuSpan = renderedComponent.getByTestId("timeline-settings");
    fireEvent.click(settingMenuSpan);

    const menuPopupDiv = renderedComponent.getByTestId("timeline-contextmenu-div");
    expect(menuPopupDiv).not.to.be.null;
    // renderedComponent.debug();

    const repeatItem = renderedComponent.getByText("timeline.repeat");
    expect(repeatItem).not.to.be.null;
    fireEvent.click(repeatItem);

    // clicking on menuitem will close menu
    // fireEvent.click(settingMenuSpan);
    const possibleMenuPopupDiv = renderedComponent.queryByTestId("timeline-contextmenu-div");
    expect(possibleMenuPopupDiv).to.be.null;

    expect(dataProvider.settingsCallbackCalled).to.be.true;

    const durationInputField = renderedComponent.queryByTestId("timeline-duration-edit-input");
    expect(durationInputField).not.to.be.null;
    fireEvent.change(durationInputField!, { target: { value: "00:44" } });
    // callback is not triggered until Enter key is pressed.
    fireEvent.keyDown(durationInputField!, { key: "Enter" });

    expect(dataProvider.duration).to.be.equal(44000);

    fireEvent.change(durationInputField!, { target: { value: "00:66" } });
    // callback is not triggered until Enter key is pressed.
    fireEvent.keyDown(durationInputField!, { key: "Escape" });

    expect(dataProvider.duration).to.be.equal(44000);

    act(() => durationInputField!.focus());
    fireEvent.change(durationInputField!, { target: { value: "00:66" } });
    act(() => settingMenuSpan.focus());
    // expect(dataProvider.duration).to.be.equal(66000);
  });
  it("open/close timeline settings - always minimized", async () => {
    const dataProvider = new TestTimelineDataProvider(false);

    const renderedComponent = render(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={true}
        showDuration={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );

    expect(renderedComponent).not.to.be.undefined;

    const settingMenuSpan = renderedComponent.getByTestId("timeline-settings");
    fireEvent.click(settingMenuSpan);

    const menuPopupDiv = renderedComponent.getByTestId("timeline-contextmenu-div");
    expect(menuPopupDiv).not.to.be.null;
    // renderedComponent.debug();

    const expandItem = renderedComponent.getByText("timeline.expand");
    expect(expandItem).not.to.be.null;

    renderedComponent.rerender(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={true}
        showDuration={false}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={true}
      />,
    );

    const nullExpandItem = renderedComponent.queryByText("timeline.expand");
    expect(nullExpandItem).to.be.null;
  });
  it("Dynamically set duration", async () => {
    const dataProvider = new TestTimelineDataProvider(false);

    const renderedComponent = render(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={true}
        showDuration={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );

    expect(renderedComponent).not.to.be.undefined;

    // trigger call to componentDidUpdate
    renderedComponent.rerender(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={50000}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={true}
        showDuration={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );
  });
  it("onPlayPause called for TimerPausePlay event", () => {
    const dataProvider = new TestTimelineDataProvider(false);
    const spyOnPlayPause = sinon.spy();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderedComponent = render(<TimelineComponent
      initialDuration={dataProvider.initialDuration}
      totalDuration={dataProvider.duration}
      minimized={true}
      showDuration={true}
      onChange={dataProvider.onAnimationFractionChanged}
      onJump={dataProvider.onJump}
      onPlayPause={spyOnPlayPause}
      componentId={"TestTimeline"} />);

    const args: TimelinePausePlayArgs = { uiComponentId: "TestTimeline", timelineAction: TimelinePausePlayAction.Play };
    UiAdmin.sendUiEvent(args);
    args.timelineAction = TimelinePausePlayAction.Pause;
    UiAdmin.sendUiEvent(args);
    args.timelineAction = TimelinePausePlayAction.Toggle;
    UiAdmin.sendUiEvent(args);
    expect(spyOnPlayPause.calledThrice).to.be.true;
    UiAdmin.sendUiEvent({ uiComponentId: "TestTimeline" });
    // onPlayPause should not be called again, since the args don't include an action
    expect(spyOnPlayPause.calledThrice).to.be.true;
  });
  it("re-render on repeat change", () => {
    const dataProvider = new TestTimelineDataProvider(false);
    const renderedComponent = render(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        repeat={false}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );

    expect(renderedComponent).not.to.be.undefined;
    expect(dataProvider.getSettings().loop).to.be.false;

    // trigger call to componentDidUpdate
    renderedComponent.rerender(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={50000}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        repeat={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );
    expect(dataProvider.getSettings().loop).to.be.true;
  });
  it("test repeat button does not loop endlessly with external state variable", () => {
    const renderedComponent = render(
      <TestRepeatTimelineComponent  />,
    );

    expect(renderedComponent).not.to.be.undefined;

    const settingMenuSpan = renderedComponent.getByTestId("timeline-settings");
    fireEvent.click(settingMenuSpan);

    const menuPopupDiv = renderedComponent.getByTestId("timeline-contextmenu-div");
    expect(menuPopupDiv).not.to.be.null;
    // renderedComponent.debug();
    const repeatItem = renderedComponent.getByText("timeline.repeat");
    expect(repeatItem).not.to.be.null;
    fireEvent.click(repeatItem);
  });
  it("re-render on totalDuration change", () => {
    const dataProvider = new TestTimelineDataProvider(false);
    const renderedComponent = render(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        repeat={false}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );

    expect(renderedComponent).not.to.be.undefined;

    const newDuration = dataProvider.getSettings().duration! * 2;

    // trigger call to componentDidUpdate
    renderedComponent.rerender(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={50000}
        totalDuration={newDuration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        repeat={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );
    expect(dataProvider.getSettings().duration).to.be.eq(newDuration);
  });
  it("re-render on new start and end date", () => {
    const dataProvider = new TestTimelineDataProvider(false);
    const renderedComponent = render(
      <TimelineComponent
        startDate={dataProvider.start}
        endDate={dataProvider.end}
        initialDuration={dataProvider.initialDuration}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );

    expect(renderedComponent).not.to.be.undefined;
    const newStartDate = new Date(2019, 4, 1);
    const newEndDate = new Date(2020, 5, 7);

    // trigger call to componentDidUpdate
    renderedComponent.rerender(
      <TimelineComponent
        startDate={newStartDate}
        endDate={newEndDate}
        initialDuration={50000}
        totalDuration={dataProvider.duration}
        milestones={dataProvider.getMilestones()}
        minimized={false}
        showDuration={true}
        onChange={dataProvider.onAnimationFractionChanged}
        onSettingsChange={dataProvider.onPlaybackSettingChanged}
        onPlayPause={dataProvider.onPlayPause}
        alwaysMinimized={false}
      />,
    );
    const startDateItem = renderedComponent.container.querySelector(".start-date") as HTMLElement;
    expect(startDateItem).not.to.be.null;
    expect(startDateItem?.innerHTML).to.be.eq(newStartDate.toLocaleDateString());

    const endDateItem = renderedComponent.container.querySelector(".end-date") as HTMLElement;
    expect(endDateItem).not.to.be.null;
    expect(endDateItem?.innerHTML).to.be.eq(newEndDate.toLocaleDateString());
  });
});
