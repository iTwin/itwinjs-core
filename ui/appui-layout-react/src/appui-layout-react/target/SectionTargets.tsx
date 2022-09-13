/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./SectionTargets.scss";
import * as React from "react";
import { TargetContainer } from "./TargetContainer";
import { SectionTarget, useTargetDirection } from "./SectionTarget";
import { withTargetVersion } from "./TargetOptions";
import { WidgetState } from "../state/WidgetState";
import { MergeTarget } from "./MergeTarget";

/** @internal */
export interface SectionTargetsProps {
  widgetId: WidgetState["id"];
}

/** @internal */
export const SectionTargets = withTargetVersion("2", function SectionTargets(props: SectionTargetsProps) {
  const direction = useTargetDirection();
  const { widgetId } = props;
  return (
    <TargetContainer
      className="nz-target-sectionTargets"
      direction={direction}
    >
      <SectionTarget sectionIndex={0} />
      <MergeTarget widgetId={widgetId} />
      <SectionTarget sectionIndex={1} />
    </TargetContainer>
  );
});
