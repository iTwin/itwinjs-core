/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import { StringGetter, AbstractItemProps } from "./AbstractItemProps";
import { AnyItemProps } from "./AnyItemProps";

/** Available Group Button directions.
 * @beta
 */
export enum GroupButtonDirection {
  Left,
  Top,
  Right,
  Bottom,
}

/** Definition for a Group Button that opens a group of items.
 * @beta
 */
export interface AbstractGroupItemProps extends AbstractItemProps {
  /** Id of Group item */
  groupId: string;
  /** Items shown in the GroupButton popup */
  items: AnyItemProps[];
  /** Direction of the popup relative to the button */
  direction?: GroupButtonDirection;
  /** Maximum number of items in each column in the popup */
  itemsInColumn?: number;
  /** if set, it is used to explicitly set a label at top of open group component. */
  panelLabel?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if panelLabel is not explicitly set. */
  paneLabelKey?: string;
}
