/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";

import { IconSpec as Core_IconSpec, IconProps as Core_IconProps, Icon as Core_Icon } from "@bentley/ui-core";

/** Prototype for an IconSpec which can be a string or a ReactNode.
 * Deprecated - Use [IconSpec]($ui-core) in bentley/ui-core instead.
 * @public
 * @deprecated Use IconSpec in bentley/ui-core instead
 */
export type IconSpec = Core_IconSpec;

/** Properties for the [[Icon]] React component.
 * Deprecated - Use [IconProps]($ui-core) in bentley/ui-core instead.
 * @public
 * @deprecated Use IconProps in bentley/ui-core instead
 */

export interface IconProps extends Core_IconProps { }   // tslint:disable-line: no-empty-interface

/** Icon Functional component.
 * Deprecated - Use the [Icon]($ui-core) component in bentley/ui-core instead.
 * @public
 * @deprecated Use the Icon component in bentley/ui-core instead
 */
export const Icon = Core_Icon;    // tslint:disable-line: variable-name

/** @internal */
export type dummy_node = React.ReactNode;
