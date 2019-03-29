import * as React from "react";
import { PlayerButton, PlayButton } from "./PlayerButton";
import { Popup, Position, Toggle } from "@bentley/ui-core";
import { Milestone } from "./Interfaces";
import { Timeline } from "./Timeline";
import { Scrubber } from "./Scrubber";
import { InlineEdit } from "./InlineEdit";
import "./TimelineComponent.scss";

interface TimelineComponentProps {
  startDate: Date; // start date
  endDate: Date;   // end date
  totalDuration: number;  // total duration in milliseconds
  milestones?: Milestone[]; // optional milestones
  hideTimeline?: boolean;  // show in mini-mode
  onChange?: (duration: number) => void; // callback with current value (as a fraction)
}

interface TimelineComponentState {
  isSettingsOpen: boolean; // settings popup is opened or closed
  isPlaying: boolean; // timeline is currently playing or paused
  hideTimeline?: boolean;
  currentDuration: number; // current duration in milliseconds
  totalDuration: number;  // total duration in milliseconds
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
      currentDuration: 0,
      totalDuration: this.props.totalDuration,
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
      this.setState ( {currentDuration: 0}, (() => this._play() ));
    } else
      this._play();
  }

  // user clicked pause button
  private _onPause = () => {
    if (!this.state.isPlaying)
      return; // not playing

    // stop requesting frames
    window.cancelAnimationFrame(this._requestFrame);

    // stop playing
    this.setState({ isPlaying: false });
  }

  // user clicked on timeline rail or dragged scrubber handle
  private _onTimelineChange = (values: ReadonlyArray<number>) => {
    const currentDuration = values[0];
    this._setDuration(currentDuration);
  }

  // set the current duration, which will call the OnChange callback
  private _setDuration = (currentDuration: number) => {
    this._timeLastCycle = new Date().getTime();
    this.setState( {currentDuration} );
    if (this.props.onChange) {
      const fraction = currentDuration / this.state.totalDuration;
      this.props.onChange (fraction);
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
    this._setDuration (duration);

    // stop the animation!
    if (duration >= this.state.totalDuration) {
      window.cancelAnimationFrame(this._requestFrame);
      this.setState({ isPlaying: false });
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
    this.setState ({ totalDuration: milliseconds });
  }

  private _onSettingsClick = () => {
    this.setState ({ isSettingsOpen: !this.state.isSettingsOpen });
  }

  private _onHideTimelineChanged = () => {
    this.setState ({ hideTimeline: !this.state.hideTimeline });
  }

  private _currentDate = () => {
    const fraction = this.state.currentDuration / this.state.totalDuration;
    const timeElapsed = (this.props.endDate.getTime() - this.props.startDate.getTime()) * fraction;
    return new Date(this.props.startDate.getTime() + timeElapsed);
  }

  public render() {
    const { startDate, endDate, milestones } = this.props;
    const { totalDuration } = this.state;
    const currentDate = this._currentDate();
    const durationString = this._displayTime(totalDuration);

    return (
      <div className="timeline-component">
        {!this.state.hideTimeline &&
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
            <PlayerButton className="play-repeat" onClick={this._onForward}>
              <span className="icon icon-placeholder"></span>
            </PlayerButton>
            <span className="current-date">{currentDate.toLocaleDateString()}</span>
            <span className="timeline-settings icon icon-settings" ref={(element) => { this._settings = element; }} onClick={this._onSettingsClick} ></span>
            <Popup position={Position.TopRight} target={this._settings} isOpen={this.state.isSettingsOpen} onClose={this._onSettingsClick} >
              <div className="settings-content">
                <div>
                  <span>Show Timline:</span>
                  <Toggle showCheckmark={true} isOn={!this.state.hideTimeline} onChange={this._onHideTimelineChanged} />
                </div>
              </div>
            </Popup>
          </div>
        }
        {!this.state.hideTimeline &&
          <Timeline
            className="timeline-timeline"
            startDate={startDate}
            endDate={endDate}
            selectedDate={currentDate}
            milestones={milestones}
            isPlaying={this.state.isPlaying}
          />
        }
        <div className="scrubber">
          {this.state.hideTimeline && <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} />}
          <span className="start-time">00:00</span>
          <Scrubber
            className="scrubber-scrubber"
            currentDuration={this.state.currentDuration}
            totalDuration={totalDuration}
            isPlaying={this.state.isPlaying}
            onChange={this._onTimelineChange}
            onUpdate={this._onTimelineChange}
          />
          <InlineEdit className="end-time" defaultValue={durationString} onChange={this._onTotalDurationChange} />
        </div>
      </div>
    );
  }
}
