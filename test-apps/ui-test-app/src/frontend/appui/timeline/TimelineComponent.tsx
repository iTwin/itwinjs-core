import * as React from "react";
import { PlayerButton, PlayButton } from "./PlayerButton";
import { ContentViewManager } from "@bentley/ui-framework";
import { Popup, Position, Toggle } from "@bentley/ui-core";
import { Milestone } from "./Interfaces";
import { Timeline } from "./Timeline";
import { Scrubber } from "./Scrubber";
import "./TimelineComponent.scss";

interface TimelineComponentProps {
  startDate: Date;
  endDate: Date;
  selectedDate: Date;
  duration: number;
  milestones?: Milestone[];
  hideTimeline: boolean;
}

interface TimelineComponentState {
  isSettingsOpen: boolean;
  isPlaying: boolean;
  isSeeking: boolean;
  selectedDate: Date;
  showSettings: boolean;
  hideTimeline: boolean;
}

export class TimelineComponent extends React.PureComponent<TimelineComponentProps, TimelineComponentState> {
  private _timeLastCycle = 0;
  private _requestFrame = 0;
  private _unmounted = false;
  private _settings: HTMLElement | null = null;

  public static defaultProps = {
    duration: 20000, // 20 seconds
    hideTimeline: false,
  };

  constructor(props: TimelineComponentProps) {
    super(props);

    this.state = {
      isSettingsOpen: false,
      isPlaying: false,
      isSeeking: false,
      selectedDate: this.props.startDate,
      showSettings: false,
      hideTimeline: this.props.hideTimeline,
    };
  }

  public componentWillReceiveProps(nextProps: Readonly<TimelineComponentProps>): void {
    if (nextProps.startDate !== this.props.startDate) {
      this.setState({ selectedDate: nextProps.startDate });
    }
  }

  public componentWillUnmount() {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = 0;
      window.cancelAnimationFrame(this._requestFrame);
    }
    this._unmounted = true;
  }

  private _onBackward = () => {
  }

  private _onForward = () => {
  }

  private _onPlay = () => {
    if (this.state.isPlaying)
      return;

    // start playing
    this.setState({ isPlaying: true });

    // request the next frame
    this._timeLastCycle = new Date().getTime();
    this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
  }

  private _onPause = () => {
    if (!this.state.isPlaying)
      return;

    // stop requesting frames
    window.cancelAnimationFrame(this._requestFrame);

    // stop playing
    this.setState({ isPlaying: false });
  }

  private updateAnimationFraction (fraction: number) {
    const activeContentControl = ContentViewManager.getActiveContentControl();
    if (activeContentControl && activeContentControl.viewport) {
      activeContentControl.viewport.animationFraction = fraction;
    }
  }

  private _onTimelineChange = (_values: ReadonlyArray<number>) => {
    // set the new selected date
    const selectedDate = new Date(_values[0]);
    this._setSelectedDate(selectedDate);
  }

  private _onTimelineUpdate = (_values: ReadonlyArray<number>) => {
    // set the new selected date
    const updateDate = new Date(_values[0]);
    this._setSelectedDate(updateDate);
    // const fraction = (updateDate.getTime() - this.props.startDate.getTime()) / (this.props.endDate.getTime() - this.props.startDate.getTime());
    // this.updateAnimationFraction(fraction);
  }

  private _setSelectedDate = (selectedDate: Date) => {
    this._timeLastCycle = new Date().getTime();
    this.setState( {selectedDate}, () => {
      // update the animation fraction after the selected date has been updated
      const fraction = (this.state.selectedDate.getTime() - this.props.startDate.getTime()) / (this.props.endDate.getTime() - this.props.startDate.getTime());
      this.updateAnimationFraction(fraction);
    });
  }

  private _updateAnimation = (_timestamp: number) => {
    if (!this.state.isPlaying && !this._unmounted) {
      return;
    }

    // update selected date
    const currentTime = new Date().getTime();
    const fractionElapsed = (currentTime - this._timeLastCycle) / this.props.duration;
    const timeElapsed = (this.props.endDate.getTime() - this.props.startDate.getTime()) * fractionElapsed; // time since last cycle
    const selectedDate = new Date(this.state.selectedDate.getTime() + timeElapsed);
    this._setSelectedDate (selectedDate);

    // stop the animation!
    if (selectedDate >= this.props.endDate) {
      window.cancelAnimationFrame(this._requestFrame);
      this.setState({ isPlaying: false });
      return;
    }

    // continue the animation - request the next frame
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

  private _onSettingsClick = () => {
    this.setState ({ showSettings: !this.state.showSettings });
  }

  private _onHideTimelineChanged = () => {
    this.setState ({ hideTimeline: !this.state.hideTimeline });
  }

  public render() {
    const { startDate, endDate, milestones, duration } = this.props;
    const endTime = this._displayTime(duration);

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
            <span className="current-date">{this.state.selectedDate.toLocaleDateString()}</span>
            <span className="timeline-settings icon icon-settings" ref={(element) => { this._settings = element; }} onClick={this._onSettingsClick} ></span>
            <Popup position={Position.TopRight} target={this._settings} isOpen={this.state.showSettings} onClose={this._onSettingsClick} >
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
            selectedDate={this.state.selectedDate}
            milestones={milestones}
            isPlaying={this.state.isPlaying}
          />
        }
        <div className="scrubber">
          {this.state.hideTimeline && <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} />}
          <span className="start-time">00:00</span>
          <Scrubber
            startDate={startDate}
            endDate={endDate}
            selectedDate={this.state.selectedDate}
            isPlaying={this.state.isPlaying}
            onChange={this._onTimelineChange}
            onUpdate={this._onTimelineUpdate}
          />
          <span className="end-time">{endTime}</span>
        </div>
      </div>
    );
  }
}
