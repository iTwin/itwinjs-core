/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./BackArrow.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps, useTargeted } from "@itwin/core-react";

/** Properties of [[BackArrow]] component.
 * @internal
 */
export interface BackArrowProps extends CommonProps, NoChildrenProps {
  /** Function called when arrow is clicked. */
  onClick?: () => void;
  /** Function called when pointer up event is received. */
  onPointerUp?: () => void;
}

/** Back arrow used in [[NestedGroup]] component.
 * @internal
 */
// eslint-disable-next-line react/display-name
export const BackArrow = React.memo<React.FC<BackArrowProps>>(
  (props: BackArrowProps) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const targeted = useTargeted(ref);
    const className = classnames(
      "components-toolbar-item-expandable-group-backArrow",
      targeted && "components-targeted",
      props.className);
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <div
        className={className}
        onClick={props.onClick}
        onPointerUp={props.onPointerUp}
        ref={ref}
        style={props.style}
        role="button"
        tabIndex={-1}
      />
    );
  });
