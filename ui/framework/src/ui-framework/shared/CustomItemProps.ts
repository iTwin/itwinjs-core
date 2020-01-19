/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { ItemProps } from "./ItemProps";

/** Definition for a Custom item that renders a React component.
 * @beta
 */
export interface CustomItemProps extends ItemProps {
  customId?: string;
  reactElement: React.ReactNode;
}
