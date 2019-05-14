/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * A data structure which describes property editor used
 * for a content [[Field]].
 *
 * @public
 */
export interface EditorDescription {
  /** Unique name */
  name: string;
  /** Editor-specific parameters */
  params: any;
}
