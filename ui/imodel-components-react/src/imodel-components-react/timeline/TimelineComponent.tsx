/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Timeline
 */

import "./TimelineComponent.scss";
import classnames from "classnames";
import * as React from "react";
import type { GenericUiEventArgs} from "@itwin/appui-abstract";
import { UiAdmin } from "@itwin/appui-abstract";
import { ContextMenu, ContextMenuDirection, ContextMenuItem } from "@itwin/core-react";
import { toDateString, toTimeString, UiComponents } from "@itwin/components-react";
import { UiIModelComponents } from "../UiIModelComponents";
import { InlineEdit } from "./InlineEdit";
import type { PlaybackSettings, TimelinePausePlayArgs } from "./interfaces";
import { TimelinePausePlayAction } from "./interfaces";
import { PlayButton, PlayerButton } from "./PlayerButton";
import { Scrubber } from "./Scrubber";

// cspell:ignore millisec

const slowSpeed = 60 * 1000;
const mediumSpeed = 20 * 1000;
const fastSpeed = 10 * 1000;
/**
 * [[TimelineMenuItemOption]]: specifies how the app wants the timeline speeds to be installed on the TimelineComponent's ContextMenu
 * "replace" : use the app-supplied items in place of the standard items
 * "append" : add the app-supplied items following the standard items
 * "prefix" : add the app-supplied items before the standard items
 *
 * @public
 */
export type TimelineMenuItemOption = "replace" | "append" | "prefix";
/**
 * [[TimelineMenuItemProps]] specifies playback speed entries in the Timeline's ContextMenu
 * @public
 */
export interface TimelineMenuItemProps {
  /** localized label for menu item */
  label: string;

  /** duration for the entire timeline to play */
  timelineDuration: number;
}
/** TimelineDateMarkerProps: Mark a date on the timeline with an indicator
 * @public
 */
export interface TimelineDateMarkerProps {
  /** Date to mark. If undefined, today's date will be used. */
  date?: Date;
  /** ReactNode to use as the marker on the timeline. If undefined, a short vertical bar will mark the date. */
  dateMarker?: React.ReactNode;
}
/**
 *  [[TimelineComponentProps]] configure the timeline
 * @public
 */
export interface TimelineComponentProps {
  /** Start date: beginning of the date range of a date-based timeline. */
  startDate?: Date;
  /** End date: end of the date range of a date-based timeline. */
  endDate?: Date;
  /** Total duration: range of the timeline in milliseconds. */
  totalDuration: number;
  /** Initial value for the current duration (the location of the thumb) in milliseconds */
  initialDuration?: number;
  /** Show in minimized mode (For future use. This prop will always be treated as true.) */
  minimized?: boolean;
  /** When playing, repeat indefinitely */
  repeat?: boolean;
  /** Show duration instead of time */
  showDuration?: boolean;
  /** Callback with current duration value (as a fraction) */
  onChange?: (duration: number) => void;
  /** Callback triggered when play/pause button is pressed */
  onPlayPause?: (playing: boolean) => void;
  /** Callback triggered when backward/forward buttons are pressed */
  onJump?: (forward: boolean) => void;
  /** Callback triggered when a setting is changed */
  onSettingsChange?: (arg: PlaybackSettings) => void;
  /** Always display in miniMode with no expand menu (For future use. This prop will always be treated as true) */
  alwaysMinimized?: boolean;
  /** ComponentId -- must be set to use TimelineComponentEvents */
  componentId?: string;
  /** Include the repeat option on the Timeline Context Menu */
  includeRepeat?: boolean;
  /** App-supplied speed entries in the Timeline Context Menu */
  appMenuItems?: TimelineMenuItemProps[];
  /** How to include the supplied app menu items in the Timeline Context Menu (prefix, append, replace)*/
  appMenuItemOption?: TimelineMenuItemOption;
  /** Display date and time offset by the number of minutes specified. When undefined - local timezone will be used */
  timeZoneOffset?: number;
  /** Display a marker on the timeline rail to indicate current date - will only work if starDate and endDate are defined */
  markDate?: TimelineDateMarkerProps;

}
/** @internal */
interface TimelineComponentState {
  /** Settings popup is opened or closed */
  isSettingsOpen: boolean;
  /**  True if timeline is currently playing, false if paused */
  isPlaying: boolean;
  /** Minimized mode (For future use. This will always be true) */
  minimized?: boolean;
  /** Current duration in milliseconds */
  currentDuration: number;
  /** Total duration in milliseconds */
  totalDuration: number;
  /** If true, automatically restart when the timeline is finished playing */
  repeat: boolean;
  /** If true, include the repeat option in the timeline context menu */
  includeRepeat: boolean;
}

/**
 * [[TimelineComponent]] is used to playback timeline data
 * @public
 */
export class TimelineComponent extends React.Component<TimelineComponentProps, TimelineComponentState> {
  private _timeLastCycle = 0;
  private _requestFrame = 0;
  private _unmounted = false;
  private _settings: HTMLElement | null = null;
  private _repeatLabel: string;
  private _removeListener?: () => void;
  private _standardTimelineMenuItems: TimelineMenuItemProps[] = [
    { label: UiIModelComponents.translate("timeline.slow"), timelineDuration: slowSpeed },
    { label: UiIModelComponents.translate("timeline.medium"), timelineDuration: mediumSpeed },
    { label: UiIModelComponents.translate("timeline.fast"), timelineDuration: fastSpeed },
  ];

  constructor(props: TimelineComponentProps) {
    super(props);

    this.state = {
      isSettingsOpen: false,
      isPlaying: false,
      minimized: true,
      currentDuration: props.initialDuration ? props.initialDuration : /* istanbul ignore next */ 0,
      totalDuration: this.props.totalDuration,
      repeat: this.props.repeat ? true : false,
      includeRepeat: this.props.includeRepeat || this.props.includeRepeat === undefined ? true : false,
    };

    this._repeatLabel = UiIModelComponents.translate("timeline.repeat");
    // istanbul ignore else
    if (this.props.componentId) { // can't handle an event if we have no id
      this._removeListener = UiAdmin.onGenericUiEvent.addListener(this._handleTimelinePausePlayEvent);
    }
  }

  public override componentWillUnmount() {
    if (this._removeListener)
      this._removeListener();
    window.cancelAnimationFrame(this._requestFrame);
    this._unmounted = true;
  }

  public override shouldComponentUpdate(nextProps: TimelineComponentProps, nextState: TimelineComponentState) {
    let result = false;

    // istanbul ignore next
    if (nextState !== this.state || nextProps !== this.props ||
      nextProps.startDate !== this.props.startDate ||
      nextProps.endDate !== this.props.endDate ||
      nextProps.initialDuration !== this.props.initialDuration ||
      nextProps.repeat !== this.props.repeat
    )
      result = true;

    return result;
  }

  public override componentDidUpdate(prevProps: TimelineComponentProps) {
    // istanbul ignore else
    if (this.props.initialDuration !== prevProps.initialDuration) {
      this._setDuration(this.props.initialDuration ? this.props.initialDuration : /* istanbul ignore next */ 0);
    }

    // istanbul ignore else
    if (this.props.repeat !== prevProps.repeat) {
      this._changeRepeatSetting(this.props.repeat);
    }

    // istanbul ignore else
    if (this.props.totalDuration !== prevProps.totalDuration) {
      this._onSetTotalDuration(this.props.totalDuration);
    }
  }
  private _handleTimelinePausePlayEvent = (args: GenericUiEventArgs): void => {
    const timelineArgs = args as TimelinePausePlayArgs;
    // istanbul ignore else
    if (!timelineArgs || this.props.componentId !== timelineArgs.uiComponentId || timelineArgs.timelineAction === undefined)
      return;

    let startPlaying: boolean;
    switch (timelineArgs.timelineAction) {
      case TimelinePausePlayAction.Play:
        startPlaying = true;
        break;
      case TimelinePausePlayAction.Pause:
        startPlaying = false;
        break;
      case TimelinePausePlayAction.Toggle:
        startPlaying = !this.state.isPlaying;
        break;
      // istanbul ignore next
      default:
        return; // throw error?
    }
    if (startPlaying)
      this._onPlay();
    else
      this._onPause();
  };

  // user clicked backward button
  private _onBackward = () => {
    // istanbul ignore else
    if (this.props.onJump)
      this.props.onJump(false);
  };

  // user clicked forward button
  private _onForward = () => {
    // istanbul ignore else
    if (this.props.onJump)
      this.props.onJump(true);
  };

  // user clicked play button
  private _onPlay = () => {
    // istanbul ignore if
    if (this.state.isPlaying)
      return;

    // timeline was complete, restart from the beginning
    if (this.state.currentDuration >= this.state.totalDuration) {
      this._replay();
    } else
      this._play();

    // istanbul ignore else
    if (this.props.onPlayPause)
      this.props.onPlayPause(true);
  };

  // user clicked pause button
  private _onPause = () => {
    // istanbul ignore if
    if (!this.state.isPlaying)
      return;

    // stop requesting frames
    window.cancelAnimationFrame(this._requestFrame);

    // stop playing
    this.setState({ isPlaying: false });

    // istanbul ignore else
    if (this.props.onPlayPause)
      this.props.onPlayPause(false);
  };

  // user clicked on timeline rail or dragged scrubber handle
  private _onTimelineChange = (values: ReadonlyArray<number>) => {
    const currentDuration = values[0];
    this._setDuration(currentDuration);
  };

  // set the current duration, which will call the OnChange callback
  private _setDuration = (currentDuration: number) => {
    this._timeLastCycle = new Date().getTime();
    // istanbul ignore else
    if (!this._unmounted)
      this.setState({ currentDuration });
    // istanbul ignore else
    if (this.props.onChange) {
      const fraction = currentDuration / this.state.totalDuration;
      this.props.onChange(fraction);
    }
  };

  // recursively update the animation until we hit the end or the pause button is clicked
  private _updateAnimation = (_timestamp: number) => {
    // istanbul ignore else
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
      else {
        // istanbul ignore else
        if (this.props.onPlayPause)
          this.props.onPlayPause(false);
      }

      return;
    }

    // continue the animation - request the next frame
    this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
  };

  private _play() {
    // start playing
    this.setState({ isPlaying: true }, () => {
      // request the next frame
      this._timeLastCycle = new Date().getTime();
      this._requestFrame = window.requestAnimationFrame(this._updateAnimation);
    });
  }

  private _replay = () => {
    // timeline was complete, restart from the beginning
    this.setState({ currentDuration: 0 }, (() => this._play()));
  };

  private _displayTime(millisec: number) {
    const addZero = (i: number) => {
      return (i < 10) ? `0${i}` : i;
    };

    const date = new Date(millisec);
    // const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    return `${addZero(minutes)}:${addZero(seconds)}`;
  }

  private _getMilliseconds(time: string) {
    // istanbul ignore else - WIP
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
    this._onSetTotalDuration(milliseconds);
  };

  private _onSettingsClick = () => {
    this.setState((prevState) => ({ isSettingsOpen: !prevState.isSettingsOpen }));
  };

  private _onCloseSettings = () => {
    this.setState({ isSettingsOpen: false });
  };

  private _changeRepeatSetting = (newValue?: boolean) => {
    // istanbul ignore else
    if (newValue !== undefined) {
      this.setState(
        () => ({ repeat: newValue, isSettingsOpen: false }),
        () => {
          // istanbul ignore else
          if (this.props.onSettingsChange) {
            this.props.onSettingsChange({ loop: this.state.repeat });
          }
        });
    }
  };

  private _onRepeatChanged = () => {
    this.setState(
      (prevState) => ({ repeat: !prevState.repeat, isSettingsOpen: false }),
      () => {
        // istanbul ignore else
        if (this.props.onSettingsChange) {
          this.props.onSettingsChange({ loop: this.state.repeat });
        }
      });
  };

  private _currentDate = (): Date => {
    const fraction = this.state.currentDuration / this.state.totalDuration;
    if (this.props.endDate && this.props.startDate) {
      const timeElapsed = (this.props.endDate.getTime() - this.props.startDate.getTime()) * fraction;
      return new Date(this.props.startDate.getTime() + timeElapsed);
    }
    return new Date();
  };

  private _onSetTotalDuration = (milliseconds: number) => {
    this.setState(
      { totalDuration: milliseconds, isSettingsOpen: false },
      () => {
        // istanbul ignore else
        if (this.props.onSettingsChange) {
          this.props.onSettingsChange({ duration: milliseconds });
        }
      });
  };
  private _createMenuItemNodes(itemList: TimelineMenuItemProps[], currentTimelineDuration: number): React.ReactNode[] {
    const itemNodes: React.ReactNode[] = [];

    itemList.forEach((item: TimelineMenuItemProps, index: number) => {
      const reactItem = this._createMenuItemNode(item, index, currentTimelineDuration);
      // istanbul ignore else
      if (reactItem)
        itemNodes.push(reactItem);
    });

    return itemNodes;
  }

  private _createMenuItemNode(item: TimelineMenuItemProps, index: number, currentTimelineDuration: number): React.ReactNode {
    let node: React.ReactNode = null;
    const label = item.label;
    const iconSpec = currentTimelineDuration === item.timelineDuration ? "icon icon-checkmark" : undefined;

    node = (
      <ContextMenuItem key={index} onSelect={() => this._onSetTotalDuration(item.timelineDuration)} icon={iconSpec} >
        {label}
      </ContextMenuItem>
    );
    return node;
  }

  private _renderSettings = () => {
    const { totalDuration } = this.state;
    let contextMenuItems: Array<TimelineMenuItemProps> = [];

    if (!this.props.appMenuItems) {
      contextMenuItems = this._standardTimelineMenuItems;
    } else {
      if (this.props.appMenuItemOption === "append") {
        contextMenuItems = this._standardTimelineMenuItems.concat(this.props.appMenuItems);
      } else if (this.props.appMenuItemOption === "prefix") {
        contextMenuItems = this.props.appMenuItems.concat(this._standardTimelineMenuItems);
      } else {
        contextMenuItems = this.props.appMenuItems;
      }
    }

    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <span data-testid="timeline-settings" className="timeline-settings icon icon-more-vertical-2" ref={(element) => this._settings = element} onClick={this._onSettingsClick}
          role="button" tabIndex={-1} title={UiComponents.translate("button.label.settings")}
        ></span>
        <ContextMenu opened={this.state.isSettingsOpen} onOutsideClick={this._onCloseSettings} direction={ContextMenuDirection.BottomRight} data-testid="timeline-contextmenu-div">
          {this.state.includeRepeat && <ContextMenuItem icon={this.state.repeat && "icon icon-checkmark"} onSelect={this._onRepeatChanged}>{this._repeatLabel}</ContextMenuItem>}
          {this.state.includeRepeat && <div className="separator" role="separator" />}
          {this._createMenuItemNodes(contextMenuItems, totalDuration)}
        </ContextMenu>
      </>
    );
  };

  public override render() {
    const { startDate, endDate, showDuration, timeZoneOffset } = this.props;
    const { currentDuration, totalDuration, minimized } = this.state;
    const currentDate = this._currentDate();
    const durationString = this._displayTime(currentDuration);
    const totalDurationString = this._displayTime(totalDuration);
    const hasDates = !!startDate && !!endDate;

    return (
      <div data-testid="timeline-component" className={classnames("timeline-component", !!minimized && "minimized", hasDates && "has-dates")} >
        <div className="header">
          <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} data-testid="timeline-play" />
          <PlayerButton className="play-backward" icon="icon-caret-left" onClick={this._onBackward}
            title={UiIModelComponents.translate("timeline.backward")} />
          <PlayerButton className="play-button-step" icon="icon-media-controls-circular-play"
            isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause}
            title={UiIModelComponents.translate("timeline.step")} />
          <PlayerButton className="play-forward" icon="icon-caret-right" onClick={this._onForward}
            title={UiIModelComponents.translate("timeline.backward")} />
          <span className="current-date">{toDateString(currentDate, timeZoneOffset)}</span>
        </div>
        <div className="scrubber">
          <PlayButton className="play-button" isPlaying={this.state.isPlaying} onPlay={this._onPlay} onPause={this._onPause} />
          <div className="start-time-container">
            {hasDates && <span data-testid="test-start-date" className="start-date">{toDateString(startDate, timeZoneOffset)}</span>}
            {hasDates && !showDuration && <span data-testid="test-start-time" className="start-time">{toTimeString(startDate, timeZoneOffset)}</span>}
            {showDuration && <span className="duration-start-time">{durationString}</span>}
          </div>
          <Scrubber
            className="slider"
            currentDuration={this.state.currentDuration}
            totalDuration={totalDuration}
            startDate={startDate}
            endDate={endDate}
            isPlaying={this.state.isPlaying}
            inMiniMode={!!minimized}
            showTime={!showDuration}
            onChange={this._onTimelineChange}
            onUpdate={this._onTimelineChange}
            timeZoneOffset={this.props.timeZoneOffset}
            markDate={this.props.markDate}
          />
          <div className="end-time-container">
            {hasDates && <span className="end-date">{toDateString(endDate, timeZoneOffset)}</span>}
            {hasDates && !showDuration && <span className="end-time">{toTimeString(endDate, timeZoneOffset)}</span>}
            {showDuration && <InlineEdit className="duration-end-time" defaultValue={totalDurationString} onChange={this._onTotalDurationChange} />}
          </div>
          {minimized && this._renderSettings()}
        </div>
      </div>
    );
  }
}
