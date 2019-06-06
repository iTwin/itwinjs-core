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

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
interface HandleProps {
  domain: number[];
  handle: SliderItem;
  getHandleProps: GetHandleProps;
}

// tslint:disable-next-line: variable-name
const Handle: React.FunctionComponent<HandleProps> = (props) => {
  const {
    domain: [min, max],
    handle: { id, value, percent },
    getHandleProps,
  } = props;

  return <div className="scrubberHandle" role="slider" aria-valuemin={min}
    aria-valuemax={max} aria-valuenow={value} style={{ left: `${percent}%` }}
    {...getHandleProps(id)} />;
};

// *******************************************************
// RAIL COMPONENT
// *******************************************************
interface RailProps {
  getRailProps: GetRailProps;
}

// tslint:disable-next-line: variable-name
const Rails: React.FunctionComponent<RailProps> = (props) => {
  const { getRailProps } = props;

  return (
    <>
      <div className="railOuter" {...getRailProps()} />
      <div className="railInner" />
    </>
  );
};

interface SpeedProps extends CommonProps {
  speed: number;
  onChange?: (value: number) => void;
}

/** Speed Timeline used in Solar Timeline component
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const SpeedTimeline: React.FunctionComponent<SpeedProps> = (props) => {
  // istanbul ignore next - WIP
  const onChange = (values: ReadonlyArray<number>) => {
    const value = values[0];
    if (props.onChange && (value >= 1 && value <= 6))
      props.onChange(value);
  };

  const domain = [1, 6];

  return (
    <div className={classnames("speed-timeline", props.className)}>
      <Slider
        mode={1}
        step={1}
        domain={domain}
        onChange={onChange}
        onUpdate={onChange}
        values={[props.speed]}>
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
};
