/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import * as React from "react";
// eslint-disable-next-line no-duplicate-imports
import { useRef } from "react";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { FlatNonPrimitivePropertyRenderer } from "./FlatNonPrimitivePropertyRenderer";
import { CommonPropertyRenderer } from "../../../properties/renderers/CommonPropertyRenderer";
import { EditorContainer, PropertyUpdatedArgs } from "../../../editors/EditorContainer";
import { PropertyCategory } from "../../PropertyDataProvider";
import { PropertyValueRendererManager } from "../../../properties/ValueRendererManager";
import { SharedRendererProps } from "../../../properties/renderers/PropertyRenderer";
import {
  PrimitivePropertyRenderer,
  PrimitiveRendererProps,
} from "../../../properties/renderers/PrimitivePropertyRenderer";
import { Orientation } from "@bentley/ui-core";

/** Properties of [[FlatPropertyRenderer]] React component
 * @internal
 */
export interface FlatPropertyRendererProps extends SharedRendererProps {
  category?: PropertyCategory;
  /** Custom value renderer */
  propertyValueRendererManager?: PropertyValueRendererManager;
  /** Multiplier of how much the property is indented to the right */
  indentation?: number;
  /** Indicates property is being edited @beta */
  isEditing?: boolean;
  /** Called when property edit is committed. @beta */
  onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
  /** Called when property edit is cancelled. @beta */
  onEditCancel?: () => void;
  /** Whether property value is displayed in expanded state. */
  isExpanded: boolean;
  /** Called when toggling between expanded and collapsed property value display state. */
  onExpansionToggled: () => void;
  /** Reports property height changes. */
  onHeightChanged?: (newHeight: number) => void;

  children?: never;
}

/**  A React component that renders flat properties
 * @internal
 */
export const FlatPropertyRenderer: React.FC<FlatPropertyRendererProps> = (props) => {
  const {
    category,
    propertyValueRendererManager,
    isEditing,
    onEditCommit,
    onEditCancel,
    onHeightChanged,
    ...passthroughProps
  } = props;

  const valueElementRenderer = () => (
    <DisplayValue
      propertyRecord={passthroughProps.propertyRecord}
      orientation={passthroughProps.orientation}
      columnRatio={passthroughProps.columnRatio}
      width={passthroughProps.width}
      category={category}
      propertyValueRendererManager={propertyValueRendererManager}
      isEditing={isEditing}
      onEditCommit={onEditCommit}
      onEditCancel={onEditCancel}
      isExpanded={passthroughProps.isExpanded}
      onExpansionToggled={passthroughProps.onExpansionToggled}
      onHeightChanged={onHeightChanged}
    />
  );

  const primitiveRendererProps: PrimitiveRendererProps = {
    ...passthroughProps,
    valueElementRenderer,
    indentation: props.indentation,
  };

  switch (props.propertyRecord.value.valueFormat) {
    case PropertyValueFormat.Primitive:
      return (<PrimitivePropertyRenderer {...primitiveRendererProps} />);
    case PropertyValueFormat.Array:
      // If array is empty, render it as a primitive property
      if (props.propertyRecord.value.items.length === 0)
        return (<PrimitivePropertyRenderer {...primitiveRendererProps} />);

    // eslint-disable-next-line no-fallthrough
    case PropertyValueFormat.Struct:
      return (
        <FlatNonPrimitivePropertyRenderer
          isExpanded={props.isExpanded}
          onExpandToggled={props.onExpansionToggled}
          {...primitiveRendererProps}
        />
      );
  }
};

interface DisplayValueProps {
  isEditing?: boolean;
  propertyRecord: PropertyRecord;

  orientation: Orientation;
  columnRatio?: number;
  /** Pass width to rerender component as property grid width changes */
  width?: number;
  indentation?: number;
  propertyValueRendererManager?: PropertyValueRendererManager;
  isExpanded?: boolean;
  onExpansionToggled?: () => void;
  onHeightChanged?: (newHeight: number) => void;

  category?: PropertyCategory;
  onEditCancel?: () => void;
  onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
}

const DisplayValue: React.FC<DisplayValueProps> = (props) => {
  useResetHeightOnEdit(props.isEditing, props.onHeightChanged);

  if (props.isEditing) {
    const _onEditCommit = (args: PropertyUpdatedArgs) => {
      /* istanbul ignore else */
      if (props.category)
        props.onEditCommit?.(args, props.category);
    };

    return (
      <EditorContainer
        propertyRecord={props.propertyRecord}
        onCommit={_onEditCommit}
        onCancel={props.onEditCancel ?? (() => { })}
        setFocus={true}
      />
    );
  }

  return (
    <>
      {
        CommonPropertyRenderer.createNewDisplayValue(
          props.orientation,
          props.propertyRecord,
          props.indentation,
          props.propertyValueRendererManager,
          props.isExpanded,
          props.onExpansionToggled,
          props.onHeightChanged,
        )
      }
    </>
  );
};

function useResetHeightOnEdit(isEditing?: boolean, onHeightChanged?: (newHeight: number) => void) {
  const previousEditingStatusRef = useRef(isEditing);
  if (!previousEditingStatusRef.current && isEditing) {
    onHeightChanged?.(27);
  }

  previousEditingStatusRef.current = isEditing;
}
