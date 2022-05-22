/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Text
 */

// cSpell:ignore focusvalue

import * as React from "react";
import classnames from "classnames";
import { IMatch } from "@itwin/appui-abstract";
import { CommonProps } from "../utils/Props";
import "./FilteredText.scss";

/** Props supported by [FilteredText] component
 * @alpha
 */
export interface FilteredTextProps extends CommonProps {
  /** string that matched a filter string */
  value: string;
  /** define array of start and end positions of filter matches. */
  matches?: IMatch[];
  /** holds class name for matching span text. */
  matchClassName?: string;
  /** holds style for matching span text. */
  matchStyle?: React.CSSProperties;
}

/** Component used to highlight filter matches within a text string.
 * @alpha
 */
export function FilteredText(props: FilteredTextProps) {
  const { value, className, matches, matchClassName, matchStyle, ...otherProps } = props;
  // istanbul ignore else
  if (matches && matches.length > 0) {
    const spans: React.ReactNode[] = [];

    let startPos = 0;
    for (const span of matches) {
    // istanbul ignore else
      if (span.start !== startPos)
        spans.push(<span key={startPos} className="uicore-partial-filtered-text">{value.substr(startPos, span.start - startPos)}</span >);
      spans.push(<span key={span.start} style={matchStyle} className={classnames("uicore-filtered-text-match", matchClassName)}>{value.substr(span.start, span.end - span.start)}</span>);
      startPos = span.end;
    }
    const endPos = value.length;
    // istanbul ignore else
    if (startPos < endPos) {
      spans.push(<span key={startPos} className="uicore-partial-filtered-text">{value.substr(startPos, endPos - startPos)}</span>);
    }
    return <div {...otherProps} className={classnames("uicore-filtered-text", className)} title={value}>{spans}</div>;
  }

  return <span {...otherProps} className={classnames("uicore-filtered-text", className)} title={value}>{value}</span>;
}
