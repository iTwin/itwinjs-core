/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./SectionOutline.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { useTargeted } from "../base/DragManager";
import { isSectionTargetState } from "../base/NineZoneState";
import { PanelSideContext } from "../widget-panels/Panel";
import { useSectionTargetDirection } from "../target/SectionTarget";

/** @internal */
export interface SectionOutlineProps extends CommonProps {
  sectionIndex: 0 | 1;
}

/** @internal */
export function SectionOutline(props: SectionOutlineProps) { // eslint-disable-line @typescript-eslint/naming-convention
  const hidden = useHidden(props.sectionIndex);
  const direction = useSectionTargetDirection();
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
      style={props.style}
    />
  );
}

function useHidden(sectionIndex: 0 | 1) {
  const side = React.useContext(PanelSideContext);
  const targeted = useTargeted();
  return React.useMemo(() => {
    if (!targeted)
      return true;

    if (!isSectionTargetState(targeted))
      return true;

    if (targeted.sectionIndex !== sectionIndex)
      return true;
    if (targeted.side !== side)
      return true;

    return false;
  }, [targeted, side, sectionIndex]);
}
