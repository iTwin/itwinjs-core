/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { PlayerButton, PlayButton } from "./PlayerButton";
import { Position } from "@bentley/ui-core";
import { Milestone } from "@bentley/ui-components";
import { Timeline } from "./Timeline";
import { Scrubber } from "./Scrubber";
import { InlineEdit } from "./InlineEdit";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import "./TimelineComponent.scss";

interface TimelineComponentProps {
  startDate?: Date; // start date
  endDate?: Date;   // end date
  totalDuration: number;  // total duration in milliseconds
  initialDuration?: number;  // initial value for current duration in milliseconds
  milestones?: Milestone[]; // optional milestones
  hideTimeline?: boolean;  // show in mini-mode
  onChange?: (duration: number) => void; // callback with current value (as a fraction)
  onPlayPause?: (playing: boolean) => void; // callback with play/pause button is pressed
}

interface TimelineComponentState {
  isSettingsOpen: boolean; // settings popup is opened or closed
  isPlaying: boolean; // timeline is currently playing or paused
  hideTimeline?: boolean;
  currentDuration: number; // current duration in milliseconds
  totalDuration: number;  // total duration in milliseconds
  repeat: boolean; // automatically restart when the timeline is finished playing
}

export class TimelineComponent extends React.PureComponent<TimelineComponentProps, TimelineComponentState> {
  private _timeLastCycle = 0;
  private _requestFrame = 0;
  private _unmounted = false;
  private _settings: HTMLElement | null = null;

  constructor(props: TimelineComponentProps) {
    super(props);

    this.state = {
      isSettingsOpen: false,
      isPlaying: false,
      hideTimeline: this.props.hideTimeline,
      currentDuration: props.initialDuration ? props.initialDuration : 0,
      totalDuration: this.props.totalDuration,
      repeat: false,
    };
  }

  public componentWillUnmount() {
    window.cancelAnimationFrame(this._requestFrame);
    this._unmounted = true;
  }

  // user clicked backward button
  private _onBackward = () => {
  }

  // user clicked forward button
  private _onForward = () => {
  }

  // user clicked play button
  private _onPlay = () => {
    if (this.state.isPlaying)
      return;

    // timeline was complete, restart from the beginning
    if (this.state.currentDuration >= this.state.totalDuration) {
      this._replay();
    } else
      this._play();

    if (this.props.onPlayPause)
      this.props.onPlayPause(true);
  }

  // user clicked pause button
  private _onPause = () => {
    if (!this.state.isPlaying)
      return; // not playing

    // stop requesting frames
    window.cancelAnimationFrame(this._requestFrame);

    // stop playing
    this.setState({ isPlaying: false });

    if (this.props.onPlayPause)
      this.props.onPlayPause(false);
  }

  // user clicked on timeline rail or dragged scrubber handle
  private _onTimelineChange = (values: ReadonlyArray<number>) => {
    const currentDuration = values[0];
    this._setDuration(currentDuration);
  }

  // set the current duration, which will call the OnChange callback
  private _setDuration = (currentDuration: number) => {
    this._timeLastCycle = new Date().getTime();
    this.setState({ currentDuration });
    if (this.props.onChange) {
      const fraction = currentDuration / this.state.totalDuration;
      this.props.onChange(fraction);
    }
  }

  // recursively update the animation until we hit the end or the pause button is clicked
  private _updateAnimation = (_timestamp: number) => {
    if (!this.state.isPlaying && !this._unmounted) {
      return;
    }

    // update duration
    const currentTime = new Date().getTime();
    const millisecondsElapsed = currentTime - this._timeLastCycle;
    const duration = this.state.currentDuration + millisecondsElapsed;
    this._setDuration(duration);

    // stop the animation!
    if (duration >= this.state.totalDuration) {
      window.cancelAnimationFrame(this._requestFrame);
      this.setState({ isPlaying: false });
      if (this.state.repeat)
        this._replay();
      return;
    }

    // continue the animation - request the next frame
    this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
  }

  private _play() {
    // start playing
    this.setState({ isPlaying: true });

    // request the next frame
    this._timeLastCycle = new Date().getTime();
    this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
  }

  private _replay = () => {
    // timeline was complete, restart from the beginning
    this.setState({ currentDuration: 0 }, (() => this._play()));
  }

  private _displayTime(millisec: number) {
    const addZero = (i: number) => {
      return (i < 10) ? "0" + i : i;
    };

    const date = new Date(millisec);
    // const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    return `${addZero(minutes)}:${addZero(seconds)}`;
  }

  private _getMilliseconds(time: string) {
    if (time.indexOf(":") !== -1) {
      return (Number(time.split(":")[0]) * 60 + Number(time.split(":")[1])) * 1000;
    } else {
      return Number(time) * 1000;
    }
  }

  // user changed the total duration
  private _onTotalDurationChange = (value: string) => {
    // NOTE: we should reset the current duration to 0
    const milliseconds = this._getMilliseconds(value);
    this.setState({ totalDuration: milliseconds });
  }

  private _onSettingsClick = () => {
    this.setState({ isSettingsOpen: !this.state.isSettingsOpen });
  }

  private _onCloseSettings = () => {
    this.setState({ isSettingsOpen: false });
  }

  private _onHideTimelineChanged = () => {
    this.setState({ hideTimeline: !this.state.hideTimeline, isSettingsOpen: false });
  }

  private _onLoopChanged = () => {
    this.setState({ repeat: !this.state.repeat, isSettingsOpen: false });
  }

  private _currentDate = (): Date => {
    const fraction = this.state.currentDuration / this.state.totalDuration;
    if (this.props.endDate && this.props.startDate) {
      const timeElapsed = (this.props.endDate.getTime() - this.props.startDate.getTime()) * fraction;
      return new Date(this.props.startDate.getTime() + timeElapsed);
    }
    return new Date();
  }

  private _renderSettings = () => {
    const className = classnames("timeline-settings icon icon-more-vertical-2", this.state.hideTimeline && "mini-mode");
    const expandName = (this.state.hideTimeline) ? "Expand" : "Minimize";
    return (
      <>
        <span className={className} ref={(element) => this._settings = element} onClick={this._onSettingsClick} ></span>
        <ContextMenu parent={this._settings} isOpened={this.state.isSettingsOpen} onClickOutside={this._onCloseSettings.bind(this)} position={Position.BottomRight}>
          <ContextMenuItem name={expandName} onClick={this._onHideTimelineChanged} />
          <ContextMenuItem name="Repeat" checked={this.state.repeat} onClick={this._onLoopChanged} />
        </ContextMenu>
      </>
    );
  }

  public render() {
    const { startDate, endDate, milestones } = this.props;
    const { currentDuration, totalDuration, hideTimeline } = this.state;
    const currentDate = this._currentDate();
    const durationString = this._displayTime(currentDuration);
    const totalDurationString = this._displayTime(totalDuration);
    // const miniMode = this.state.hideTimeline || undefined === startDate || undefined === endDate;
    // const hasMilestones = this.props.milestones && this.props.milestones.length > 0 ? true : false;
    const hasDates = startDate && endDate ? true : false;
    const miniMode = hideTimeline || !hasDates;

    return (
      <div className="timeline-component">
        {!miniMode &&
          <>
            <div className="header">
              <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} />
              <PlayerButton className="play-backward" onClick={this._onBackward}>
                <span className="icon icon-caret-left"></span>
              </PlayerButton>
              <PlayerButton className="play-button-step" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause}>
                <span className="icon icon-media-controls-circular-play"></span>
              </PlayerButton>
              <PlayerButton className="play-forward" onClick={this._onForward}>
                <span className="icon icon-caret-right"></span>
              </PlayerButton>
              <span className="current-date">{currentDate.toLocaleDateString()}</span>
              {this._renderSettings()}
            </div>
            <Timeline
              className="timeline-timeline"
              startDate={startDate!}
              endDate={endDate!}
              selectedDate={currentDate}
              milestones={milestones}
              isPlaying={this.state.isPlaying} />
          </>
        }
        <div className="scrubber">
          {miniMode && <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} />}
          <div className="scrubber-container">
            {hasDates &&
              <div className="dates-container">
                <span className="start-date">{startDate!.toLocaleDateString()}</span>
                <span className="end-date">{endDate!.toLocaleDateString()}</span>
              </div>
            }
            <div className="content">
              <span className="start-time">{durationString}</span>
              <Scrubber
                className="scrubber-scrubber"
                currentDuration={this.state.currentDuration}
                totalDuration={totalDuration}
                isPlaying={this.state.isPlaying}
                onChange={this._onTimelineChange}
                onUpdate={this._onTimelineChange} />
              <InlineEdit className="end-time" defaultValue={totalDurationString} onChange={this._onTotalDurationChange} />
            </div>
          </div>
         {miniMode && this._renderSettings()}
        </div>
      </div>
    );
  }
}
