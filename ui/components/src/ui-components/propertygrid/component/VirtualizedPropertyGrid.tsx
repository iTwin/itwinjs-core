/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import "./VirtualizedPropertyGrid.scss";
import classnames from "classnames";
import * as _ from "lodash";
import * as React from "react";
import AutoSizer, { Size } from "react-virtualized-auto-sizer";
import { areEqual, ListChildComponentProps, VariableSizeList } from "react-window";
import { assert } from "@bentley/bentleyjs-core";
import { PropertyRecord } from "@bentley/ui-abstract";
import { Orientation, RatioChangeResult } from "@bentley/ui-core";
import { FilteredType, MutableCategorizedPrimitiveProperty, MutableGridCategory } from "../../../ui-components";
import { HighlightingComponentProps } from "../../common/HighlightingComponentProps";
import { createContextWithMandatoryProvider } from "../../common/UseContextWithMandatoryProvider";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";
import { ActionButtonRenderer } from "../../properties/renderers/ActionButtonRenderer";
import { PropertyGridColumnInfo } from "../../properties/renderers/PropertyGridColumns";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { FlatGridItem, GridCategoryItem } from "../internal/flat-items/FlatGridItem";
import { FlatGridItemType } from "../internal/flat-items/MutableFlatGridItem";
import { FlatPropertyRenderer } from "../internal/flat-properties/FlatPropertyRenderer";
import { IPropertyGridEventHandler } from "../internal/PropertyGridEventHandler";
import { IPropertyGridModel } from "../internal/PropertyGridModel";
import { PropertyCategory } from "../PropertyDataProvider";
import { ColumnResizingPropertyListPropsSupplier } from "./ColumnResizingPropertyListPropsSupplier";
import { FlatItemNestedBorderWrapper } from "./FlatItemNestedBorderWrapper";
import { PropertyCategoryBlock } from "./PropertyCategoryBlock";
import { CommonPropertyGridProps, PropertyGridCommons } from "./PropertyGridCommons";
import { PropertyGridEventsRelatedPropsSupplier } from "./PropertyGridEventsRelatedPropsSupplier";

/** Properties for [[VirtualizedPropertyGrid]] React component
 * @alpha
 */
export interface VirtualizedPropertyGridProps extends CommonPropertyGridProps {
  model: IPropertyGridModel;
  eventHandler: IPropertyGridEventHandler;
  highlight?: HighlightingComponentProps & { filteredTypes?: FilteredType[] };
}

/** State of [[VirtualizedPropertyGrid]] React component
 * @internal
 */
interface VirtualizedPropertyGridState {
  /** List of PropertyGrid categories */
  gridItems: FlatGridItem[];
  /** Actual orientation used by the property grid */
  orientation: Orientation;
  /** Width of PropertyGrid */
  width: number;
  /** Keeps record of dynamic node heights */
  dynamicNodeHeights: Map<string, number>;
}

/**
 * Context of [[VirtualizedPropertyGrid]] component.
 * @internal
 */
export interface VirtualizedPropertyGridContext {
  gridItems: FlatGridItem[];
  gridEventHandler: IPropertyGridEventHandler;
  gridModel: IPropertyGridModel;
  gridContext: {
    style?: React.CSSProperties;
    className?: string;
    listWidth: number;
    orientation: Orientation;
    actionButtonRenderers?: ActionButtonRenderer[];
    propertyValueRendererManager?: PropertyValueRendererManager;

    isPropertyHoverEnabled?: boolean;
    isPropertySelectionEnabled?: boolean;
    selectedPropertyKey?: string;
    onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
    onPropertyRightClicked?: (property: PropertyRecord, key?: string) => void;
    onPropertyContextMenu?: (property: PropertyRecord, e: React.MouseEvent) => void;
    editingPropertyKey?: string;
    onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
    onEditCancel?: () => void;
    onNodeHeightChanged: (index: number, key: string, height: number) => void;

    columnRatio?: number;
    onColumnChanged?: (ratio: number) => void | RatioChangeResult;
    isResizeHandleHovered?: boolean;
    onResizeHandleHoverChanged?: (isHovered: boolean) => void;
    isResizeHandleBeingDragged?: boolean;
    onResizeHandleDragChanged?: (isDragStarted: boolean) => void;
    columnInfo?: PropertyGridColumnInfo;

    highlight?: HighlightingComponentProps & { filteredTypes?: FilteredType[] };
  };
}

/**
 * [[VirtualizedPropertyGrid]] context provider, consumer and custom hook.
 * @internal
 */
export const [
  /**
   * Context of [[VirtualizedPropertyGrid]] provider.
   * @internal
   */
  VirtualizedPropertyGridContextProvider,

  /**
   * Context of [[VirtualizedPropertyGrid]] consumer.
   * @internal
   */
  VirtualizedPropertyGridContextConsumer,

  /**
   * Custom hook to use [[VirtualizedPropertyGrid]] context.
   * @internal
   */
  useVirtualizedPropertyGridContext,
] = createContextWithMandatoryProvider<VirtualizedPropertyGridContext>("VirtualizedPropertyGrid");

/**
 * VirtualizedPropertyGrid React component.
 * @alpha
 */
export class VirtualizedPropertyGrid extends React.Component<VirtualizedPropertyGridProps, VirtualizedPropertyGridState> {
  private _listRef = React.createRef<VariableSizeList>();

  /** @internal */
  constructor(props: VirtualizedPropertyGridProps) {
    super(props);
    this.state = {
      gridItems: [],
      orientation: this.getPreferredOrientation(),
      width: 0,
      dynamicNodeHeights: new Map(),
    };
  }

  /** @internal */
  public componentDidUpdate(prevProps: VirtualizedPropertyGridProps) {
    if (this.props.orientation !== prevProps.orientation
      || this.props.isOrientationFixed !== prevProps.isOrientationFixed
      || this.props.horizontalOrientationMinWidth !== prevProps.horizontalOrientationMinWidth)
      this.updateOrientation(this.state.width);

    if (this.props.model !== prevProps.model) {
      // istanbul ignore else
      if (this._listRef.current)
        this._listRef.current.resetAfterIndex(0);
    }

    if (this.props.highlight !== prevProps.highlight && this.props.highlight?.activeHighlight && this.state.gridItems.length !== 0) {
      let index = 0;
      let foundMatchingItem = false;
      for (const item of this.state.gridItems) {
        if (item instanceof MutableCategorizedPrimitiveProperty && this.props.highlight.activeHighlight.highlightedItemIdentifier === item.derivedRecord.property.name
          || item instanceof MutableGridCategory && this.props.highlight.activeHighlight.highlightedItemIdentifier === item.name) {
          foundMatchingItem = true;
          break;
        }
        index++;
      }
      if (foundMatchingItem) {
        // istanbul ignore else
        if (this._listRef.current)
          this._listRef.current.scrollToItem(index);
      }
    }
  }

  /** @internal */
  public static getDerivedStateFromProps(props: VirtualizedPropertyGridProps, state: VirtualizedPropertyGridState): VirtualizedPropertyGridState | null {
    return {
      ...state,
      gridItems: props.model.getVisibleFlatGrid(),
    };
  }

  private getPreferredOrientation(): Orientation {
    return (this.props.orientation !== undefined) ? this.props.orientation : Orientation.Horizontal;
  }

  private _onResize = (onListWidthChanged?: (width: number, orientation: Orientation) => void) => {
    return ({ width }: Size) => {
      const orientation = this.updateOrientation(width);

      // istanbul ignore else
      if (onListWidthChanged)
        onListWidthChanged(width, orientation);
    };
  };

  private updateOrientation(width: number): Orientation {
    const { orientation, isOrientationFixed, horizontalOrientationMinWidth } = { ...this.props };
    const currentOrientation = PropertyGridCommons.getCurrentOrientation(width, orientation, isOrientationFixed, horizontalOrientationMinWidth);

    if (currentOrientation !== this.state.orientation || width !== this.state.width) {
      this.setState({ orientation: currentOrientation, width });
      this._listRef.current?.resetAfterIndex(0);
    }

    return currentOrientation;
  }

  /**
   * Calculate given node height depending on it's type, position in category, parent category depth and current orientation.
   * @param node FlatGridItem node for which to calculate height
   * @returns current height of node.
   */
  private calculateNodeHeight(node: FlatGridItem) {
    const spaceAfterCollapsedCategory = !node.isExpanded ? 3 : 0;
    const categoryHeight = 33 + spaceAfterCollapsedCategory;
    const categoryPropertyHeight = 27;
    const verticalPrimitivePropertyHeight = 42;

    const marginAfterLastRootCategoryItem = node.isLastInRootCategory ? 8 : 0;

    const marginAfterEachBorder = 3;
    const bordersAndMarginAfterLastCategoryItem = (node.lastInNumberOfCategories * marginAfterEachBorder);

    let currentHeight = getPropertyHeight(this.state);
    currentHeight += bordersAndMarginAfterLastCategoryItem;
    currentHeight += marginAfterLastRootCategoryItem;
    return currentHeight;

    function getPropertyHeight(state: VirtualizedPropertyGridState) {
      const dynamicHeight = state.dynamicNodeHeights.get(node.key);
      if (dynamicHeight !== undefined) {
        return dynamicHeight + (state.orientation === Orientation.Vertical ? 15 : 0);
      }

      if (node.type === FlatGridItemType.Category) {
        return categoryHeight;
      }

      if (state.orientation === Orientation.Vertical && node.type === FlatGridItemType.Primitive) {
        return verticalPrimitivePropertyHeight;
      }

      return categoryPropertyHeight;
    }
  }

  private _handleNodeHeightChange = (index: number, key: string, newHeight: number) => {
    if (this.state.dynamicNodeHeights.get(key) === newHeight) {
      return;
    }

    assert(this._listRef.current !== null);
    this._listRef.current.resetAfterIndex(index);

    this.setState((state) => {
      return {
        ...state,
        dynamicNodeHeights: new Map(state.dynamicNodeHeights).set(key, newHeight),
      };
    });
  };

  private _calculateNodeHeightByIndex = (index: number) => {
    const node = this.state.gridItems[index];
    return this.calculateNodeHeight(node);
  };

  private calculateEstimatedHeight() {
    let sum = 0;
    for (const node of this.state.gridItems)
      sum += this.calculateNodeHeight(node);

    return Math.ceil(sum / this.state.gridItems.length);
  }

  private _getNodeKey = (index: number) => {
    const node = this.state.gridItems[index];
    return node.key;
  };

  /** @internal */
  public render() {
    return <ColumnResizingPropertyListPropsSupplier
      orientation={this.state.orientation}
      minLabelWidth={this.props.minLabelWidth}
      minValueWidth={this.props.minValueWidth}
      actionButtonWidth={this.props.actionButtonWidth}
    >
      {(resizeContext) => (
        <PropertyGridEventsRelatedPropsSupplier isPropertySelectionEnabled={this.props.isPropertySelectionEnabled}
          isPropertySelectionOnRightClickEnabled={this.props.isPropertySelectionOnRightClickEnabled}
          isPropertyEditingEnabled={this.props.isPropertyEditingEnabled}
          onPropertyContextMenu={this.props.onPropertyContextMenu}
          onPropertyUpdated={this.props.onPropertyUpdated}
          onPropertySelectionChanged={this.props.onPropertySelectionChanged}
          isPropertyHoverEnabled={this.props.isPropertyHoverEnabled}
        >
          {(selectionContext) => {
            const onResize = _.memoize(this._onResize(resizeContext.onListWidthChanged), () => resizeContext.onListWidthChanged);
            return (< AutoSizer onResize={onResize}>
              {({ width, height }: Size) => {
                const renderContext: VirtualizedPropertyGridContext = {
                  gridItems: this.state.gridItems,
                  gridEventHandler: this.props.eventHandler,
                  gridModel: this.props.model,
                  gridContext: {
                    ...selectionContext,
                    ...resizeContext,
                    style: this.props.style,
                    className: this.props.className,
                    listWidth: this.state.width,

                    propertyValueRendererManager: this.props.propertyValueRendererManager,
                    actionButtonRenderers: this.props.actionButtonRenderers,

                    onNodeHeightChanged: this._handleNodeHeightChange,
                    highlight: this.props.highlight,
                  },
                };

                return (<VirtualizedPropertyGridContextProvider value={renderContext} >
                  <div className="components-property-grid">
                    <VariableSizeList
                      className={classnames("components-property-grid-wrapper", "ReactWindow__VariableSizeList", this.props.className)}
                      width={width}
                      height={height}
                      itemCount={this.state.gridItems.length}
                      itemSize={this._calculateNodeHeightByIndex}
                      estimatedItemSize={this.calculateEstimatedHeight()}
                      overscanCount={10}
                      layout="vertical"
                      style={this.props.style}
                      itemKey={this._getNodeKey}
                      ref={this._listRef}
                    >
                      {FlatGridItemNode}
                    </VariableSizeList>
                  </div>
                </VirtualizedPropertyGridContextProvider>);
              }}
            </AutoSizer>
            );
          }}
        </PropertyGridEventsRelatedPropsSupplier >
      )}
    </ColumnResizingPropertyListPropsSupplier>;
  }
}

const FlatGridItemNode = React.memo(
  ({ index, style }: ListChildComponentProps) => {
    const { gridItems, gridEventHandler, gridModel, gridContext } = useVirtualizedPropertyGridContext(FlatGridItemNode);
    const node = gridItems[index];

    const onExpansionToggled = React.useCallback(
      () => gridEventHandler.onExpansionToggled(node.selectionKey),
      [gridEventHandler, node.selectionKey],
    );
    const onHeightChanged = React.useCallback(
      (newHeight: number) => gridContext.onNodeHeightChanged(index, node.key, newHeight),
      [gridContext, index, node.key],
    );

    function getDisplayNode() {
      const lastInNumberOfCategories = node.lastInNumberOfCategories;
      switch (node.type) {
        case FlatGridItemType.Category:
          return (
            <FlatItemNestedBorderWrapper borderCount={node.depth}
              bottomBorderCount={lastInNumberOfCategories - 1}
              className={classnames("virtualized-grid-node-content", "virtualized-grid-node-category")}
            >
              <PropertyCategoryBlock
                className={gridContext.className}
                style={gridContext.style}
                category={node.derivedCategory}
                onExpansionToggled={onExpansionToggled}
                highlight={gridContext.highlight?.filteredTypes?.includes(FilteredType.Category) ?
                  gridContext.highlight :
                  undefined
                }
              />
            </FlatItemNestedBorderWrapper>
          );
        case FlatGridItemType.Array:
        case FlatGridItemType.Struct:
        case FlatGridItemType.Primitive:
          const selectionKey = node.selectionKey;
          const parentCategoryItem = gridModel.getItem(node.parentCategorySelectionKey) as GridCategoryItem;

          return (
            <FlatItemNestedBorderWrapper
              borderCount={parentCategoryItem.depth + 1}
              bottomBorderCount={lastInNumberOfCategories}
              className="virtualized-grid-node-content"
            >
              <FlatPropertyRenderer
                key={node.key}
                uniqueKey={selectionKey}
                propertyRecord={node.derivedRecord}
                orientation={gridContext.orientation}
                indentation={node.depth}
                width={gridContext.listWidth}

                isHoverable={gridContext.isPropertyHoverEnabled}
                isSelectable={gridContext.isPropertySelectionEnabled}
                isSelected={selectionKey === gridContext.selectedPropertyKey}

                onClick={node.type === FlatGridItemType.Primitive ? gridContext.onPropertyClicked : undefined}
                onRightClick={node.type === FlatGridItemType.Primitive ? gridContext.onPropertyRightClicked : undefined}
                onContextMenu={gridContext.onPropertyContextMenu}

                category={parentCategoryItem.derivedCategory}
                isEditing={selectionKey === gridContext.editingPropertyKey}
                onEditCommit={gridContext.onEditCommit}
                onEditCancel={gridContext.onEditCancel}

                isExpanded={node.isExpanded}
                onExpansionToggled={onExpansionToggled}
                onHeightChanged={onHeightChanged}

                actionButtonRenderers={gridContext.actionButtonRenderers}
                propertyValueRendererManager={gridContext.propertyValueRendererManager}

                columnRatio={gridContext.columnRatio}
                columnInfo={gridContext.columnInfo}
                isResizeHandleBeingDragged={gridContext.isResizeHandleBeingDragged}
                isResizeHandleHovered={gridContext.isResizeHandleHovered}
                onColumnRatioChanged={gridContext.onColumnChanged}
                onResizeHandleDragChanged={gridContext.onResizeHandleDragChanged}
                onResizeHandleHoverChanged={gridContext.onResizeHandleHoverChanged}

                highlight={gridContext.highlight ?
                  { applyOnLabel: (gridContext.highlight.filteredTypes?.includes(FilteredType.Label)) ?? false, applyOnValue: (gridContext.highlight.filteredTypes?.includes(FilteredType.Value)) ?? false, ...gridContext.highlight } :
                  undefined
                }
              />
            </FlatItemNestedBorderWrapper>
          );
        /* istanbul ignore next */
        default:
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          const unhandledType: never = node!.type;
          throw new Error(`Unhandled item type: ${unhandledType}`);
      }
    }

    return (
      <div className="virtualized-grid-node" style={style}>
        {getDisplayNode()}
      </div>
    );
  },
  areEqual,
);

FlatGridItemNode.displayName = "FlatGridItemNode";
