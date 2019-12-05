/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { useTargeted } from "../../base/useTargeted";
import { MergeTargetProps } from "./Merge";

/** Properties of [[WidgetTarget]] component.
 * @internal
 */
export interface WidgetTargetProps extends MergeTargetProps {
  children?: React.ReactNode;
}

/** Basic component used by widget targets. I.e. [[ZoneTarget]], [[StagePanelTarget]]
 * @internal
 */
export function WidgetTarget(props: WidgetTargetProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const targeted = useTargeted(ref);
  const isInitialMount = React.useRef(true);
  const isTargeted = React.useRef(targeted);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      isTargeted.current = targeted;
      props.onTargetChanged && props.onTargetChanged(targeted);
    }
  }, [targeted]);
  React.useEffect(() => {
    return () => {
      isTargeted.current && props.onTargetChanged && props.onTargetChanged(false);
    };
  }, []);
  const className = classnames(
    "nz-zones-target-target",
    targeted && "nz-targeted",
    props.className);
  return (
    <div
      className={className}
      ref={ref}
      style={props.style}
    >
      {props.children}
    </div>
  );
}
