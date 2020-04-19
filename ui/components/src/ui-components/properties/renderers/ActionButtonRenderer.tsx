/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PropertyRecord } from "@bentley/ui-abstract";

/** Properties of [[ActionButtonRenderer]]
 * @beta
 */
export interface ActionButtonRendererProps {
  /** Property that the action button belongs to */
  property: PropertyRecord;
  /** Indicated whether a property is hovered  */
  isPropertyHovered?: boolean;
}

/**
 * Renders a React component (usually a button) for a PropertyRecord
 * @beta
 */
export type ActionButtonRenderer = (props: ActionButtonRendererProps) => React.ReactNode;
