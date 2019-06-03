/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { PropertyRecord } from "@bentley/imodeljs-frontend";
import { isPromiseLike, UnderlinedButton } from "@bentley/ui-core";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";

/** Render a single anchor tag */
function renderTag(text: string, record: PropertyRecord) {
  return (
    <UnderlinedButton
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        record.links!.onClick(record, text);
      }}
    >
      {text}
    </UnderlinedButton>
  );
}

interface Match { start: number; end: number; }

function matchComparison(matchA: Match, matchB: Match) {
  if (matchA.start > matchB.start)
    return 1;
  if (matchB.start > matchA.start)
    return -1;
  return 0;
}

function renderText(text: string, record: PropertyRecord): React.ReactNode {
  const { matcher } = record.links!;

  if (!matcher)
    return renderTag(text, record);

  const matches = matcher(text);

  // Sort just to be sure
  matches.sort(matchComparison);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of matches) {
    // If matches overlap there must be something wrong with the matcher
    if (lastIndex > match.start)
      throw new BentleyError(BentleyStatus.ERROR, "renderAnchorTag: matcher returned overlapping matches");

    if (lastIndex < match.start)
      parts.push(text.substring(lastIndex, match.start));

    const anchorText = text.substring(match.start, match.end);
    parts.push(renderTag(anchorText, record));

    lastIndex = match.end;
  }
  if (text.length > lastIndex)
    parts.push(text.substring(lastIndex));

  // Need to map, because React complains about the lack of keys
  return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
}

/** Returns true if property record has an anchor tag
 * @public
 */
export const hasLinks = (record: PropertyRecord) => !!record.links;

/** Renders anchor tag by wrapping or splitting provided text
 * @public
 */
export const renderLinks = (text: string | Promise<string>, record: PropertyRecord): React.ReactNode | Promise<React.ReactNode> => {
  if (isPromiseLike(text)) {
    return text.then((result) => renderText(result, record));
  }

  return renderText(text, record);
};

/** If record has links, wraps stringValue in them, otherwise returns unchanged stringValue
 * @public
 */
export const withLinks = (record: PropertyRecord, stringValue: string | Promise<string>): React.ReactNode | Promise<React.ReactNode> => {
  if (hasLinks(record))
    return renderLinks(stringValue, record);
  return stringValue;
};
