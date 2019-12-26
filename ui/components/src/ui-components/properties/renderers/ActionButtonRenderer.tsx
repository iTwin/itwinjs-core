/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { PropertyRecord } from "@bentley/imodeljs-frontend";

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
