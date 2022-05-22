/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { LinkElementsInfo } from "@itwin/appui-abstract";
import { UnderlinedButton } from "@itwin/core-react";

/** Render a single anchor tag */
function renderTag(text: string, links: LinkElementsInfo, highlight?: (text: string) => React.ReactNode) {
  return (
    <UnderlinedButton
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        links.onClick(text);
      }}
    >
      {highlight ? highlight(text) : text}
    </UnderlinedButton>
  );
}

interface Match { start: number, end: number }

function matchComparison(matchA: Match, matchB: Match) {
  if (matchA.start > matchB.start)
    return 1;
  if (matchB.start > matchA.start)
    return -1;
  return 0;
}

function renderTextPart(text: string, highlight?: (text: string) => React.ReactNode): React.ReactNode {
  return highlight ? highlight(text) : text;
}

function renderText(text: string, links: LinkElementsInfo, highlight?: (text: string) => React.ReactNode): React.ReactNode {
  const { matcher } = links;

  if (!matcher)
    return renderTag(text, links, highlight);

  const matches = matcher(text);

  // Sort just to be sure
  matches.sort(matchComparison);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of matches) {
    // If matches overlap there must be something wrong with the matcher
    if (lastIndex > match.start)
      throw new BentleyError(BentleyStatus.ERROR, "renderText: matcher returned overlapping matches");

    if (lastIndex < match.start)
      parts.push(renderTextPart(text.substring(lastIndex, match.start), highlight));

    const anchorText = text.substring(match.start, match.end);
    parts.push(renderTag(anchorText, links, highlight));

    lastIndex = match.end;
  }
  if (text.length > lastIndex)
    parts.push(renderTextPart(text.substring(lastIndex), highlight));

  // Need to map, because React complains about the lack of keys
  return parts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>);
}

function renderHighlighted(text: string, highlight: (text: string) => React.ReactNode) {
  return highlight(text);
}

/** Renders anchor tag by wrapping or splitting provided text
 * @public
 */
export const renderLinks = (text: string, links: LinkElementsInfo, highlight?: (text: string) => React.ReactNode): React.ReactNode => {
  return renderText(text, links, highlight);
};

/** If record has links, wraps stringValue in them, otherwise returns unchanged stringValue
 * Optionally it can highlight text
 * @public
 */
export const withLinks = (stringValue: string, links?: LinkElementsInfo, highlight?: (text: string) => React.ReactNode): React.ReactNode => {
  if (links)
    return renderLinks(stringValue, links, highlight);
  if (highlight)
    return renderHighlighted(stringValue, highlight);
  return stringValue;
};

/**
 * Properties for [[LinksRenderer]] component.
 * @alpha
 */
export interface LinksRendererProps {
  value: string;
  links?: LinkElementsInfo;
  highlighter?: (text: string) => React.ReactNode;
}

/**
 * React component for rendering string with links.
 * @alpha
 */
export function LinksRenderer(props: LinksRendererProps) {
  return <>{withLinks(props.value, props.links, props.highlighter)}</>;
}
