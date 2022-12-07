/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { WidgetProps } from "./WidgetProps";

/** Configuration from which a widget is created.
 * @beta
 */
export type WidgetConfig = Readonly<Omit<WidgetProps, "id">> & { readonly id: string }; // eslint-disable-line deprecation/deprecation
