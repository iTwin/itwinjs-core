/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

/**
 * Item highlight info used for identification of a specific highlight in an item
 * @public
 */
export interface HighlightInfo {
  /* item's identifier, used for its identification */
  highlightedItemIdentifier: string;
  /* Index of highlighted part in an item */
  highlightIndex: number;
}

/**
 * Properties used for highlighting parts in item by given text and actively highlighting one highlight in a distinct item specified in `activeHighlight`
 * @public
 */
export interface HighlightingComponentProps {
  /* Filter text which we want to highlight */
  highlightedText: string;
  /* Information about the highlight which we want to actively highlight */
  activeHighlight?: HighlightInfo;
}
