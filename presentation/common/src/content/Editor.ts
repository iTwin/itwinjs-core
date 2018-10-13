/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * A data structure which describes property editor used
 * for a content [[Field]].
 */
export default interface EditorDescription {
  /** Unique name */
  name: string;
  /** Editor-specific parameters */
  params: any;
}
