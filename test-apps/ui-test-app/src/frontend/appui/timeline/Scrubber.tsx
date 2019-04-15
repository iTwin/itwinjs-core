/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Slider, Rail, Handles, SliderItem, Tracks, GetTrackProps } from "react-compound-slider";
import "./Scrubber.scss";

const formatTime = (value: number) => {
  const addZero = (i: number) => {
    return (i < 10) ? "0" + i : i;
  };

  const date = new Date(value);
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  return `${addZero(minutes)}:${addZero(seconds)}`;
};

const formatDate = (startDate: Date, endDate: Date, fraction: number) => {
  const delta = (endDate.getTime() - startDate.getTime()) * fraction;
  const date = new Date(startDate.getTime() + delta);
  return date.toLocaleDateString();
};

// *******************************************************
// TOOLTIP RAIL
// *******************************************************
interface TooltipRailProps {
  activeHandleID?: string;
  getRailProps: (props: object) => object;
  getEventData: (e: Event) => object;
  startDate?: Date;
  endDate?: Date;
  isPlaying: boolean;  // used to not show tooltip at mouse location if timeline is playing
}

interface TooltipRailState {
  value: number | null;
  percent: number | null;
}

class TooltipRail extends React.Component<TooltipRailProps, TooltipRailState> {

  public static defaultProps = {
    disabled: false,
  };

  constructor(props: TooltipRailProps) {
    super(props);

    this.state = { value: null, percent: null };
  }

  public componentDidMount() {
    //  document.addEventListener("mousedown", this._onMouseDown);
  }

  private _onMouseEnter = () => {
    document.addEventListener("mousemove", this._onMouseMove);
  }

  private _onMouseLeave = () => {
    this.setState({ value: null, percent: null });
    document.removeEventListener("mousemove", this._onMouseMove);
  }

  private _onMouseMove = (e: Event) => {
    const { activeHandleID, getEventData } = this.props;

    if (activeHandleID) {
      this.setState({ value: null, percent: null });
    } else {
      this.setState(getEventData(e));
    }
  }

  public render() {
    const { value, percent } = this.state;
    const { activeHandleID, getRailProps, isPlaying, startDate, endDate } = this.props;
    const toolTip = (startDate && endDate) ? formatDate(startDate, endDate, (percent! / 100)) : formatTime(value!);

    return (
      <>
        {!activeHandleID && value && !isPlaying ? (
          <div className="tooltip-rail" style={{ left: `${percent}%` }}>
            <div className="tooltip">
              <span className="tooltip-text">{toolTip}</span>
            </div>
          </div>
        ) : null}
        <div
          className="rail"
          {...getRailProps({
            onMouseEnter: this._onMouseEnter,
            onMouseLeave: this._onMouseLeave,
          })}
        />
        <div className="rail-center" />
      </>
    );
  }
}

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
interface HandleProps {
  key: string;
  handle: SliderItem;
  disabled?: boolean;
  isPlaying?: boolean;
  startDate?: Date;
  endDate?: Date;
  domain: number[];
  getHandleProps: (id: string, config: object) => object;
}

interface HandleState {
  mouseOver: boolean;
}

class Handle extends React.Component<HandleProps, HandleState> {
  public static defaultProps = {
    disabled: false,
  };

  constructor(props: HandleProps) {
    super(props);

    this.state = { mouseOver: false };
  }

  private _onMouseEnter = () => {
    this.setState({ mouseOver: true });
  }

  private _onMouseLeave = () => {
    this.setState({ mouseOver: false });
  }

  public render() {
    const {
      domain: [min, max],
      handle: { id, value, percent },
      isPlaying,
      startDate,
      endDate,
      getHandleProps,
    } = this.props;
    const { mouseOver } = this.state;
    const toolTip = (startDate && endDate) ? formatDate(startDate, endDate, percent / 100) : formatTime(value);

    return (
      <>
        {(isPlaying || mouseOver) &&
          <div className="tooltip-rail" style={{ left: `${percent}%` }}>
            <div className="tooltip">
              <span className="tooltip-text">{toolTip}</span>
            </div>
          </div>
        }
        <div
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="scrubber-handle"
          style={{ left: `${percent}%` }}
          {...getHandleProps(id, {
            onMouseEnter: this._onMouseEnter,
            onMouseLeave: this._onMouseLeave,
          })}>
          <div /><div /><div />
        </div>
      </>
    );
  }
}

// *******************************************************
// TRACK COMPONENT
// *******************************************************
interface ITrackProps {
  source: SliderItem;
  target: SliderItem;
  getTrackProps: GetTrackProps;
}

function Track({ source, target, getTrackProps }: ITrackProps) {
  return (
    <div className="scrubber-track" style={{ left: `${source.percent}%`, width: `${target.percent - source.percent}%` }}
      {...getTrackProps()}
    />
  );
}

export interface ScrubberProps extends CommonProps {
  currentDuration: number;
  totalDuration: number;
  isPlaying: boolean;
  startDate?: Date;
  endDate?: Date;
  onChange?: (values: ReadonlyArray<number>) => void;
  onUpdate?: (values: ReadonlyArray<number>) => void;
  onSlideStart?: () => void;
}

export class Scrubber extends React.Component<ScrubberProps> {

  public render() {
    const { currentDuration, totalDuration, onChange, onUpdate, onSlideStart, isPlaying, startDate, endDate  } = this.props;
    const domain = [0, totalDuration];

    return (
      <Slider
        className={this.props.className}
        mode={1}
        step={1}
        domain={domain}
        onUpdate={onUpdate}
        onChange={onChange}
        onSlideStart={onSlideStart}
        values={[currentDuration]}
      >
        <Rail>
          {(railProps) => <TooltipRail {...railProps} isPlaying={isPlaying} startDate={startDate} endDate={endDate} />}
        </Rail>
        <Handles>
          {({ handles, getHandleProps }) => (
            <div className="slider-handles">
              {handles.map((handle) => (
                <Handle
                  key={handle.id}
                  isPlaying={isPlaying}
                  startDate={startDate}
                  endDate={endDate}
                  handle={handle}
                  domain={domain}
                  getHandleProps={getHandleProps}
                />
              ))}
            </div>
          )}
        </Handles>
        <Tracks right={false}>
          {({ tracks, getTrackProps }) => (
            <div className="slider-tracks">
              {tracks.map(({ id, source, target }) => (
                <Track
                  key={id}
                  source={source}
                  target={target}
                  getTrackProps={getTrackProps}
                />
              ))}
            </div>
          )}
        </Tracks>
      </Slider>
    );
  }
}
