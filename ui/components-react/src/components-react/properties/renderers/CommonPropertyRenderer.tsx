/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PropertyRecord } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import { countMatchesInString } from "../../common/countMatchesInString";
import { HighlightedText } from "../../common/HighlightedText";
import { HighlightingComponentProps } from "../../common/HighlightingComponentProps";
import { PropertyContainerType, PropertyValueRendererContext, PropertyValueRendererManager } from "../ValueRendererManager";

/**
 * @internal
 */
export class CommonPropertyRenderer {
  public static getLabelOffset(indentation?: number, orientation?: Orientation, width?: number, columnRatio?: number, minColumnLabelWidth?: number): number {
    if (!indentation)
      return 0;

    const maxIndent = 17;
    const minIndent = 6;
    if (orientation !== Orientation.Horizontal || !width || !columnRatio || !minColumnLabelWidth)
      return indentation * maxIndent;

    const currentSize = Math.ceil(width * columnRatio);
    const shrinkThreshold = minColumnLabelWidth + (maxIndent * indentation);
    if (currentSize >= shrinkThreshold)
      return indentation * maxIndent;

    const minShrink = minColumnLabelWidth + minIndent + (maxIndent * (indentation - 1));
    if (currentSize <= minShrink)
      return minIndent + this.getLabelOffset(indentation - 1, orientation, width, columnRatio, minColumnLabelWidth);

    return currentSize - minColumnLabelWidth;
  }

  public static createNewDisplayValue(
    orientation: Orientation,
    propertyRecord: PropertyRecord,
    indentation?: number,
    propertyValueRendererManager?: PropertyValueRendererManager,
    isExpanded?: boolean,
    onExpansionToggled?: () => void,
    onHeightChanged?: (newHeight: number) => void,
    highlight?: HighlightingComponentProps & { applyOnLabel: boolean, applyOnValue: boolean }
  ) {
    const highlightCallback = highlight?.applyOnValue ? (CommonPropertyRenderer.createHighlightCallback(highlight, propertyRecord)) : undefined;
    const rendererContext: PropertyValueRendererContext = {
      orientation,
      containerType: PropertyContainerType.PropertyPane,
      isExpanded,
      onExpansionToggled,
      onHeightChanged,
      textHighlighter: highlightCallback,
    };

    let displayValue: React.ReactNode | undefined;
    if (propertyValueRendererManager)
      displayValue = propertyValueRendererManager.render(propertyRecord, rendererContext);
    else
      displayValue = PropertyValueRendererManager.defaultManager.render(propertyRecord, rendererContext);

    // Align value with label if orientation is vertical
    if (orientation === Orientation.Vertical)
      displayValue = <span style={{ paddingLeft: CommonPropertyRenderer.getLabelOffset(indentation, orientation) }}>{displayValue}</span>;

    return displayValue;
  }

  private static createHighlightCallback(highlight: HighlightingComponentProps & { applyOnLabel: boolean }, propertyRecord: PropertyRecord) {
    const activeMatch = highlight.activeHighlight;
    const propertyName = activeMatch?.highlightedItemIdentifier;
    const matchIndex = activeMatch?.highlightIndex ?? 0;
    let labelMatches: number;

    if (highlight.applyOnLabel) {
      labelMatches = countMatchesInString(propertyRecord.property.displayLabel.toLowerCase(), highlight.highlightedText);
    } else {
      labelMatches = 0;
    }

    const activeMatchIndex = (propertyRecord.property.name === propertyName) && ((matchIndex - labelMatches) >= 0) ? (matchIndex - labelMatches) : undefined;
    const highlightCallback = (text: string) => (<HighlightedText text={text} activeMatchIndex={activeMatchIndex} searchText={highlight.highlightedText} />);

    return highlightCallback;
  }
}
