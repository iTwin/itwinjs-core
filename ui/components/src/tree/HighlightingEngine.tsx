/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import Highlighter from "react-highlight-words";
import * as React from "react";
import { BeInspireTreeNode } from "./component/BeInspireTree";
import "./HighlightingEngine.scss";

/** @hidden */
export interface ActiveMatchInfo {
  nodeId: string;
  matchIndex: number;
}

/** @hidden */
export interface HighlightableTreeProps {
  searchText: string;
  activeMatch?: ActiveMatchInfo;
}

/** @hidden */
export interface HighlightableTreeNodeProps {
  searchText: string;
  activeMatchIndex?: number;
}

/** @hidden */
export default class HighlightingEngine {
  private _searchText: string;
  private _activeMatch?: ActiveMatchInfo;
  public static readonly ACTIVE_CLASS_NAME = "ui-components-activehighlight";

  constructor(props: HighlightableTreeProps) {
    this._searchText = props.searchText;
    this._activeMatch = props.activeMatch;
  }

  public isNodeActive(node: BeInspireTreeNode<any>) {
    return this._activeMatch && node.id === this._activeMatch.nodeId;
  }

  public getActiveMatchIndex(node: BeInspireTreeNode<any>) {
    return this.isNodeActive(node) ? this._activeMatch!.matchIndex : undefined;
  }

  public createRenderProps(node: BeInspireTreeNode<any>): HighlightableTreeNodeProps {
    return {
      searchText: this._searchText,
      activeMatchIndex: this.getActiveMatchIndex(node),
    };
  }

  public static renderNodeLabel(text: string, props: HighlightableTreeNodeProps): React.ReactNode {
    return (
      <Highlighter
        searchWords={[props.searchText]}
        findChunks={findChunksNoRegex as any} // .d.ts declaration wrong
        activeIndex={props.activeMatchIndex as any} // .d.ts file seems to be wrong, doesn't work if it's a string
        activeClassName={HighlightingEngine.ACTIVE_CLASS_NAME}
        autoEscape={true}
        textToHighlight={text}
      />
    );
  }
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
