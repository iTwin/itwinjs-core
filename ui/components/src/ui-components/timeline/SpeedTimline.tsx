/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Timeline */

import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import { Slider, Rail, Handles, SliderItem, GetHandleProps, GetRailProps } from "react-compound-slider";
import "./SpeedTimeline.scss";

// component is in alpha state - it may change after usability testing - test coverage not complete
/* istanbul ignore file */

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
interface HandleProps {
  domain: number[];
  handle: SliderItem;
  getHandleProps: GetHandleProps;
}

class Handle extends React.Component<HandleProps> {
  public render() {
    const {
      domain: [min, max],
      handle: { id, value, percent },
      getHandleProps,
    } = this.props;

    return (
      <div
        className="scrubberHandle"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ left: `${percent}%` }}
        {...getHandleProps(id)}
      />
    );
  }
}

// *******************************************************
// RAIL COMPONENT
// *******************************************************
interface RailProps {
  getRailProps: GetRailProps;
}

class Rails extends React.Component<RailProps> {
  public render() {
    const { getRailProps } = this.props;

    return (
      <>
        <div className="railOuter" {...getRailProps()} />
        <div className="railInner" />
      </>
    );
  }
}

interface SpeedProps extends CommonProps {
  initialized?: boolean;
  speed: number;
  onChange?: (value: number) => void;
}

/** Speed Timeline used in Solar Timeline component
 * @alpha
 */
export class SpeedTimeline extends React.PureComponent<SpeedProps> {

  constructor(props: SpeedProps) {
    super(props);
  }

  private _onChange = (values: ReadonlyArray<number>) => {
    const value = values[0];
    if (this.props.onChange && (value >= 1 && value <= 6))
      this.props.onChange(value);
  }

  public render() {
    const domain = [1, 6];
    return (
      <div className={classnames("speed-timeline", this.props.className)}>
        <Slider
          mode={1}
          step={1}
          domain={domain}
          onChange={this._onChange}
          onUpdate={this._onChange}
          values={[this.props.speed]}>
          <Rail>{({ getRailProps }) => <Rails getRailProps={getRailProps} />}</Rail>
          <Handles>
            {({ handles, getHandleProps }) => (
              <div className="slider-handles">
                {handles.map((handle: SliderItem) => (
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
        </Slider>
      </div>
    );
  }
}
