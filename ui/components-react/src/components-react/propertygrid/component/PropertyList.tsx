/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import classnames from "classnames";
import * as React from "react";
import type { PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import type { CommonProps, RatioChangeResult } from "@itwin/core-react";
import { Orientation } from "@itwin/core-react";
import type { PropertyUpdatedArgs } from "../../editors/EditorContainer";
import type { ActionButtonRenderer } from "../../properties/renderers/ActionButtonRenderer";
import type { PropertyGridColumnInfo } from "../../properties/renderers/PropertyGridColumns";
import { PropertyRenderer } from "../../properties/renderers/PropertyRenderer";
import type { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import type { PropertyCategory } from "../PropertyDataProvider";

/** Properties of [[PropertyList]] React component
 * @public
 */
export interface PropertyListProps extends CommonProps {
  orientation: Orientation;
  width: number;
  category?: PropertyCategory;
  properties: PropertyRecord[];
  selectedPropertyKey?: string;
  onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyRightClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyContextMenu?: (property: PropertyRecord, e: React.MouseEvent) => void;
  columnRatio?: number;
  /** Callback to column ratio changed event */
  onColumnChanged?: (ratio: number) => void | RatioChangeResult;
  propertyValueRendererManager?: PropertyValueRendererManager;
  editingPropertyKey?: string;
  onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
  onEditCancel?: () => void;
  /** Enables/disables property hovering effect */
  isPropertyHoverEnabled?: boolean;
  /** Enables/disables property selection */
  isPropertySelectionEnabled?: boolean;
  /** Enables/disables property right click selection */
  isPropertyRightClickSelectionEnabled?: boolean;
  /** Array of action button renderers */
  actionButtonRenderers?: ActionButtonRenderer[];
  /** Is resize handle hovered */
  isResizeHandleHovered?: boolean;
  /** Callback to hover event change */
  onResizeHandleHoverChanged?: (isHovered: boolean) => void;
  /** Is resize handle being dragged */
  isResizeHandleBeingDragged?: boolean;
  /** Callback to drag event change */
  onResizeHandleDragChanged?: (isDragStarted: boolean) => void;
  /** Information for styling property grid columns */
  columnInfo?: PropertyGridColumnInfo;
}

/**
 * Get unique key for property record
 * @internal
 */
export function getPropertyKey(propertyCategory: PropertyCategory, propertyRecord: PropertyRecord) {
  return propertyCategory.name + propertyRecord.property.name;
}

/** A React component that renders multiple properties within a category as a list.
 * @public
 */
export class PropertyList extends React.Component<PropertyListProps> {

  constructor(props: PropertyListProps) {
    super(props);
  }

  private _listRef = React.createRef<HTMLDivElement>();

  private _onEditCommit = (args: PropertyUpdatedArgs) => {
    // istanbul ignore else
    if (this.props.onEditCommit && this.props.category)
      this.props.onEditCommit(args, this.props.category);
  };

  /** @internal */
  public override render() {
    const propertyListClassName = classnames(
      (this.props.orientation === Orientation.Horizontal) ? "components-property-list--horizontal" : "components-property-list--vertical",
      this.props.className,
    );

    return (
      <div className={propertyListClassName} style={this.props.style} ref={this._listRef}>
        {this.props.properties.map((propertyRecord: PropertyRecord) => {
          const key = this.props.category ? getPropertyKey(this.props.category, propertyRecord) : propertyRecord.property.name;
          return (
            <PropertyRenderer
              key={key}
              uniqueKey={key}
              isHoverable={this.props.isPropertyHoverEnabled}
              isSelectable={this.props.isPropertySelectionEnabled}
              isSelected={key === this.props.selectedPropertyKey}
              propertyRecord={propertyRecord}
              orientation={this.props.orientation}
              onClick={propertyRecord.value.valueFormat === PropertyValueFormat.Primitive ? this.props.onPropertyClicked : undefined}
              onRightClick={propertyRecord.value.valueFormat === PropertyValueFormat.Primitive ? this.props.onPropertyRightClicked : undefined}
              onContextMenu={this.props.onPropertyContextMenu}
              columnRatio={this.props.columnRatio}
              onColumnRatioChanged={this.props.onColumnChanged}
              propertyValueRendererManager={this.props.propertyValueRendererManager}
              isEditing={key === this.props.editingPropertyKey}
              onEditCommit={this._onEditCommit}
              onEditCancel={this.props.onEditCancel}
              width={this.props.width}
              actionButtonRenderers={this.props.actionButtonRenderers}
              isResizeHandleHovered={this.props.isResizeHandleHovered}
              onResizeHandleHoverChanged={this.props.onResizeHandleHoverChanged}
              isResizeHandleBeingDragged={this.props.isResizeHandleBeingDragged}
              onResizeHandleDragChanged={this.props.onResizeHandleDragChanged}
              columnInfo={this.props.columnInfo}
            />);
        })}
      </div>
    );
  }
}
