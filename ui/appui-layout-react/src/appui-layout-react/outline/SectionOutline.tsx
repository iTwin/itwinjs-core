/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./SectionOutline.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { CommonProps } from "@itwin/core-react";
import { useTargeted } from "../base/DragManager";
import { PanelSideContext, PanelStateContext } from "../widget-panels/Panel";
import { useTargetDirection } from "../target/SectionTarget";
import { withTargetVersion } from "../target/TargetOptions";
import { isSectionDropTargetState } from "../state/DropTargetState";
import { isHorizontalPanelState } from "../state/PanelState";

/** @internal */
export interface SectionOutlineProps extends CommonProps {
  sectionIndex: 0 | 1;
}

/** @internal */
export const SectionOutline = withTargetVersion("2", function SectionOutline(props: SectionOutlineProps) {
  const hidden = useHidden(props.sectionIndex);
  const direction = useTargetDirection();
  const style = useSize(props.sectionIndex);
  const className = classnames(
    "nz-outline-sectionOutline",
    `nz-${props.sectionIndex}`,
    `nz-${direction}`,
    hidden && "nz-hidden",
    props.className,
  );
  return (
    <div
      className={className}
      style={{
        ...hidden ? {} : style,
        ...props.style,
      }}
    />
  );
});

// istanbul ignore next
function useHidden(sectionIndex: SectionOutlineProps["sectionIndex"]) {
  const side = React.useContext(PanelSideContext);
  const targeted = useTargeted();
  return React.useMemo(() => {
    if (!targeted)
      return true;

    if (!isSectionDropTargetState(targeted))
      return true;

    if (targeted.sectionIndex !== sectionIndex)
      return true;
    if (targeted.side !== side)
      return true;

    return false;
  }, [targeted, side, sectionIndex]);
}

// istanbul ignore next
function useSize(sectionIndex: SectionOutlineProps["sectionIndex"]) {
  const panel = React.useContext(PanelStateContext);
  assert(!!panel);
  return React.useMemo<React.CSSProperties | undefined>(() => {
    let size = panel.splitterPercent;
    if (!size)
      return undefined;
    if (sectionIndex === 1)
      size = 100 - size;
    const style: React.CSSProperties = {};
    if (isHorizontalPanelState(panel))
      style.width = `${size}%`;
    else
      style.height = `${size}%`;
    return style;
  }, [panel, sectionIndex]);
}
