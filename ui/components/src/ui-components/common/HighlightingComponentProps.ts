/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

/**
 * Record or Category match info used for identification of a specific match in record or category
 * @beta
 */
export interface HighlightInfo {
  /* Name of the record's or category's property, used for its identification */
  highlightedItemIdentifier: string;
  /* Index of highlighted part in a record or category */
  highlightIndex: number;
}

/**
 * Properties used for highlighting matching parts in records or categories and actively highlighting one match in a specific record or category
 * @beta
 */
export interface HighlightingComponentProps {
  /* Filter text which we want to highlight */
  highlightedText: string;
  /* Information about the match which we want to actively highlight */
  activeMatch?: HighlightInfo;
}
