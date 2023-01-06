/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Timeline
 */

import "./SpeedTimeline.scss";
import * as classnames from "classnames";
import * as React from "react";
import { GetHandleProps, GetRailProps, Handles, Rail, Slider, SliderItem } from "react-compound-slider";
import { CommonProps } from "@bentley/ui-core";

// component is in alpha state - it may change after usability testing - test coverage not complete

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
interface HandleProps {
  domain: number[];
  handle: SliderItem;
  getHandleProps: GetHandleProps;
}

function Handle(props: HandleProps) {
  const {
    domain: [min, max],
    handle: { id, value, percent },
    getHandleProps,
  } = props;

  return <div className="scrubberHandle" role="slider" aria-valuemin={min}
    aria-valuemax={max} aria-valuenow={value} style={{ left: `${percent}%` }}
    {...getHandleProps(id)} />;
}

// *******************************************************
// RAIL COMPONENT
// *******************************************************
interface RailProps {
  getRailProps: GetRailProps;
}

function Rails(props: RailProps) {
  const { getRailProps } = props;

  return (
    <>
      <div className="railOuter" {...getRailProps()} />
      <div className="railInner" />
    </>
  );
}

interface SpeedProps extends CommonProps {
  speed: number;
  onChange?: (value: number) => void;
}

/** Speed Timeline used in Solar Timeline component
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function SpeedTimeline(props: SpeedProps) {
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
}
