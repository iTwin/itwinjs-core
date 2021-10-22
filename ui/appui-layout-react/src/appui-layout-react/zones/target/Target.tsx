/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import classnames from "classnames";
import * as React from "react";
import { useTargeted } from "@itwin/core-react";
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
  const onTargetChangedRef = React.useRef(props.onTargetChanged);
  const { onTargetChanged } = props;
  React.useEffect(() => {
    onTargetChangedRef.current = onTargetChanged;
  }, [onTargetChanged]);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      isTargeted.current = targeted;
      onTargetChangedRef.current && onTargetChangedRef.current(targeted);
    }
  }, [targeted]);
  React.useEffect(() => {
    return () => {
      isTargeted.current && onTargetChangedRef.current && onTargetChangedRef.current(false);
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
