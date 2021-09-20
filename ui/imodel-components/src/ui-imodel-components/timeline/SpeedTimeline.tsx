/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Timeline
 */

import "./SpeedTimeline.scss";
import classnames from "classnames";
import * as React from "react";
import { Slider } from "@itwin/itwinui-react";
import { CommonProps } from "@bentley/ui-core";

// component is in alpha state - it may change after usability testing - test coverage not complete

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

  const tooltipProps = React.useCallback(() => {
    return { visible: false };
  }, []);

  return (
    <div className={classnames("speed-timeline", props.className)}>
      <Slider
        step={1}
        min={1}
        max={6}
        minLabel=""
        maxLabel=""
        onUpdate={onChange}
        onChange={onChange}
        values={[props.speed]}
        trackDisplayMode="none"
        tooltipProps={tooltipProps} />
    </div>
  );
}
