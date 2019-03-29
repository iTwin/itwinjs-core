import * as React from "react";
import { CommonProps } from "@bentley/ui-ninezone";
import { Slider, Rail, Handles, SliderItem, Tracks, GetTrackProps } from "react-compound-slider";
import "./Scrubber.scss";

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
interface HandleProps {
  key: string;
  handle: SliderItem;
  disabled?: boolean;
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

    this.state = {mouseOver: false};
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
      disabled,
      getHandleProps,
    } = this.props;
    const { mouseOver } = this.state;

    return (
      <>
        {(mouseOver) && !disabled ? (
          <div className="tooltip-rail" style={{left: `${percent}%`}} />
        ) : null}
        <div
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="scrubber-handle"
          style={{left: `${percent}%`}}
          {...getHandleProps(id, {
            onMouseEnter: this._onMouseEnter,
            onMouseLeave: this._onMouseLeave,
          })}>
          <div/><div/><div/>
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
  onChange?: (values: ReadonlyArray<number>) => void;
  onUpdate?: (values: ReadonlyArray<number>) => void;
  onSlideStart?: () => void;
}

export class Scrubber extends React.Component<ScrubberProps> {

  public render() {
    const { currentDuration, totalDuration, onChange, onUpdate, onSlideStart } = this.props;
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
          {({ getRailProps }) => (
            <div className="scrubber-rail" {...getRailProps()} />
          )}
        </Rail>
        <Handles>
          {({ handles, getHandleProps }) => (
            <div className="slider-handles">
              {handles.map((handle) => (
                <Handle
                  key={handle.id}
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
