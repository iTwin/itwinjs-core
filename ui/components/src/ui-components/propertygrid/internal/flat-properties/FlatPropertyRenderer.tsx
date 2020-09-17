/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import _ from "lodash";
import * as React from "react";
import { PropertyValueFormat } from "@bentley/ui-abstract";
import { FlatNonPrimitivePropertyRenderer } from "./FlatNonPrimitivePropertyRenderer";
import { CommonPropertyRenderer } from "../../../properties/renderers/CommonPropertyRenderer";
import { EditorContainer, PropertyUpdatedArgs } from "../../../editors/EditorContainer";
import { PropertyCategory } from "../../PropertyDataProvider";
import { PropertyValueRendererManager } from "../../../properties/ValueRendererManager";
import { SharedRendererProps } from "../../../properties/renderers/PropertyRenderer";
import { UiComponents } from "../../../UiComponents";
import { PrimitivePropertyRenderer, PrimitiveRendererProps } from "../../../properties/renderers/PrimitivePropertyRenderer";

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

  isExpanded: boolean;
  onExpansionToggled: () => void;
}

/** State of [[FlatPropertyRenderer]] React component
 * @internal
 */
interface FlatPropertyRendererState {
  /** Currently loaded property value */
  displayValue?: React.ReactNode;
}

/**  A React component that renders flat properties
 * @internal
 */
export class FlatPropertyRenderer extends React.Component<FlatPropertyRendererProps, FlatPropertyRendererState> {
  /** @internal */
  public readonly state: Readonly<FlatPropertyRendererState> = {
    displayValue: UiComponents.translate("general.loading"),
  };

  constructor(props: FlatPropertyRendererProps) {
    super(props);
  }

  private updateDisplayValue(props: FlatPropertyRendererProps) {
    if (props.isEditing) {
      this.updateDisplayValueAsEditor(props);
      return;
    }

    const displayValue = CommonPropertyRenderer.createNewDisplayValue(props.orientation, props.propertyRecord, props.indentation, props.propertyValueRendererManager);
    this.setState({ displayValue });
  }

  private _onEditCommit = (args: PropertyUpdatedArgs) => {
    /* istanbul ignore else */
    if (this.props.onEditCommit && this.props.category)
      this.props.onEditCommit(args, this.props.category);
  }

  private _onEditCancel = () => {
    /* istanbul ignore else */
    if (this.props.onEditCancel)
      this.props.onEditCancel();
  }

  /** Display property record value in an editor */
  public updateDisplayValueAsEditor(props: FlatPropertyRendererProps) {
    this.setState({
      displayValue:
        <EditorContainer
          propertyRecord={props.propertyRecord}
          onCommit={this._onEditCommit}
          onCancel={this._onEditCancel}
          setFocus={true}
        />,
    });
  }

  /** @internal */
  public componentDidMount() {
    this.updateDisplayValue(this.props);
  }

  /** @internal */
  public componentDidUpdate(prevProps: FlatPropertyRendererProps) {
    if (prevProps.propertyRecord !== this.props.propertyRecord ||
      prevProps.isEditing !== this.props.isEditing ||
      prevProps.orientation !== this.props.orientation)
      this.updateDisplayValue(this.props);
  }

  /** @internal */
  public render() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, category, propertyValueRendererManager, isEditing, onEditCommit, onEditCancel, ...props } = this.props;
    const primitiveRendererProps: PrimitiveRendererProps = {
      ...props,
      valueElement: this.state.displayValue,
      indentation: this.props.indentation,
    };

    switch (this.props.propertyRecord.value.valueFormat) {
      case PropertyValueFormat.Primitive:
        return (<PrimitivePropertyRenderer {...primitiveRendererProps} />);
      case PropertyValueFormat.Array:
        // If array is empty, render it as a primitive property
        if (this.props.propertyRecord.value.items.length === 0)
          return (<PrimitivePropertyRenderer {...primitiveRendererProps} />);

      // eslint-disable-next-line no-fallthrough
      case PropertyValueFormat.Struct:
        return (
          <FlatNonPrimitivePropertyRenderer
            isExpanded={this.props.isExpanded}
            onExpandToggled={this.props.onExpansionToggled}
            {...primitiveRendererProps}
          />
        );
    }
  }
}
