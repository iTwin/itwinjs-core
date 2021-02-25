/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import React from "react";
import Highlighter from "react-highlight-words";
import { HighlightingEngine } from "../../ui-components";

/**
 * Properties of [[HighlightedText]]
 * @beta
 */
export interface HighlightedTextProps {
  /* Filter text which we want to highlight */
  searchText: string;
  /* Index of actively highlighted part in a text */
  activeMatchIndex?: number;
  /* Full text */
  text: string;
  /** Should search be case sensitive */
  caseSensitive?: boolean;
}

/**
 * Highlighted text
 * Used for highlighting parts in the 'text' which match with 'searchText'
 * Also actively highlights one matched part which is selected with 'activeMatchIndex'
 * @beta
 */
export function HighlightedText(props: HighlightedTextProps) {
  const { searchText, activeMatchIndex, text, caseSensitive } = props;
  return (
    <Highlighter
      searchWords={[searchText]}
      findChunks={findChunksNoRegex as any} // .d.ts declaration wrong
      activeIndex={activeMatchIndex as any} // .d.ts file seems to be wrong, doesn't work if it's a string
      activeClassName={HighlightingEngine.ACTIVE_CLASS_NAME}
      autoEscape={true}
      textToHighlight={text}
      caseSensitive={caseSensitive}
    />
  );
}

interface HighlighterChunk {
  highlight: boolean;
  start: number;
  end: number;
}
interface FindChunksArgs {
  autoEscape?: boolean;
  caseSensitive?: boolean;
  searchWords: string[];
  textToHighlight: string;
}
const findChunksNoRegex = (args: FindChunksArgs): HighlighterChunk[] => {
  const text = args.caseSensitive ? args.textToHighlight : args.textToHighlight.toUpperCase();
  const term = args.caseSensitive ? args.searchWords[0] : args.searchWords[0].toUpperCase();
  const chunks: HighlighterChunk[] = [];
  let index = text.indexOf(term);
  while (index !== -1) {
    chunks.push({ start: index, end: index + term.length, highlight: true });
    index = text.indexOf(term, index + 1);
  }
  return chunks;
};
