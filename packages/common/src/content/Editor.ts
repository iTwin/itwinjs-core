/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
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
