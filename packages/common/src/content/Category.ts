/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** A struct that describes a Field category. */
export default interface CategoryDescription {
  name: string;
  label: string;
  description: string;
  priority: number;
  expand: boolean;
}
