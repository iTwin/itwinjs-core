/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module Properties
 */

import * as React from "react";
// eslint-disable-next-line no-duplicate-imports
import { useLayoutEffect, useRef } from "react";
import { assert } from "@itwin/core-bentley";
import type { PrimitiveValue, PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { useRerender } from "../../../common/UseRerender";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { UiComponents } from "../../../UiComponents";
import type { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { useRenderedStringValue } from "./PrimitivePropertyValueRenderer";

/** @internal */
export class MultilineTextPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord): boolean {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.renderer?.name === "multiline";
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext): React.ReactNode {
    return <MultilineTextPropertyValueRendererImpl record={record} context={context} />;
  }
}

interface MultilineTextPropertyValueRendererImplProps {
  record: PropertyRecord;
  context?: PropertyValueRendererContext;
  children?: never;
}

const MultilineTextPropertyValueRendererImpl: React.FC<MultilineTextPropertyValueRendererImplProps>
  = (props) => {
    const { stringValue, element } = useRenderedStringValue(props.record, convertRecordToString, props.context);
    return (
      <MultilineTextRenderer
        style={props.context?.style}
        stringValue={stringValue}
        isExpanded={props.context?.isExpanded}
        onExpansionToggled={props.context?.onExpansionToggled}
        onHeightChanged={props.context?.onHeightChanged}
      >
        {element}
      </MultilineTextRenderer>
    );
  };

interface MultilineTextRenderer {
  stringValue?: string;
  isExpanded?: boolean;
  onExpansionToggled?: () => void;
  onHeightChanged?: (newHeight: number) => void;
  style?: React.CSSProperties;
}

/** @internal */
export const MultilineTextRenderer: React.FC<MultilineTextRenderer> = (props) => { // eslint-disable-line @typescript-eslint/no-redeclare
  const { rerenderContext, numRerenders, rerender } = useRerender({ contentOverflows: false });
  const spanRef = useRef<HTMLSpanElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const previousHeightRef = useRef(0);
  useLayoutEffect(() => {
    assert(divRef.current !== null && spanRef.current !== null);

    const contentOverflows = spanRef.current.clientWidth < spanRef.current.scrollWidth;
    if (numRerenders === 0 && contentOverflows) {
      rerender({ contentOverflows });
    }

    if (numRerenders === 1 || !contentOverflows) {
      const currentHeight = Math.max(divRef.current.offsetHeight, 27);
      if (currentHeight !== previousHeightRef.current) {
        props.onHeightChanged?.(currentHeight);
        previousHeightRef.current = currentHeight;
      }
    }
  });

  const handleExpansionToggleClick = (event: React.MouseEvent) => {
    props.onExpansionToggled?.();
    event.stopPropagation();
  };

  // In order to always trigger onMouseLeave event on PropertyView, collapse button must remain mounted at all times.
  // https://github.com/facebook/react/issues/6807
  return (
    <div ref={divRef} className="multiline">
      <span
        ref={spanRef}
        className={(numRerenders !== 0 && props.isExpanded) ? "expanded" : ""}
        style={props.style}
        title={props.isExpanded ? undefined : props.stringValue}
      >
        {props.children}
        <button
          className="expand-toggle"
          style={{ display: (rerenderContext.contentOverflows && props.isExpanded) ? "inline-block" : "none" }}
          onClick={handleExpansionToggleClick}
        >
          {UiComponents.translate("property.collapse")}
        </button>
      </span>
      {
        rerenderContext.contentOverflows && !props.isExpanded &&
        <button className="expand-toggle" onClick={handleExpansionToggleClick}>
          {UiComponents.translate("property.expand")}
        </button>
      }
    </div>
  );
};

function convertRecordToString(record: PropertyRecord): string | Promise<string> {
  return TypeConverterManager
    .getConverter(StandardTypeNames.Text)
    .convertPropertyToString(record.property, (record.value as PrimitiveValue).value);
}
