/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import * as React from "react";
import { Spinner, SpinnerSize } from "@bentley/ui-core";

/**
 * Props for [[DelayedSpinner]] component.
 * @internal
 */
export interface DelayedSpinnerProps {
  loadStart?: Date;
  delay?: number;
  size?: SpinnerSize;
}

/**
 * Spinner that is rendered with delay.
 * @internal
 */
export function DelayedSpinner(props: DelayedSpinnerProps) {
  const delay = props.delay ?? 500;
  const [loadStart] = React.useState(props.loadStart || new Date());

  const currTime = new Date();
  const diff = (currTime.getTime() - loadStart.getTime());

  const update = useForceUpdate();
  React.useEffect(() => {
    if (diff >= delay)
      return;
    const timer = setTimeout(update, delay - diff);
    return () => clearTimeout(timer);
  });

  if (diff < delay)
    return null;

  return (<Spinner size={props.size ?? SpinnerSize.Large} />);
}

const useForceUpdate = () => {
  const [value, set] = React.useState(true);
  return () => set(!value);
};
