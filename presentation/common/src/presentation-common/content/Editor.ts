/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

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
  params?: any;
}
