/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import "./VirtualizedPropertyGrid.scss";
import classnames from "classnames";
import * as React from "react";
import type { ListChildComponentProps} from "react-window";
import { areEqual, VariableSizeList } from "react-window";
import { assert } from "@itwin/core-bentley";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type { RatioChangeResult } from "@itwin/core-react";
import { Orientation } from "@itwin/core-react";
import type { HighlightingComponentProps } from "../../common/HighlightingComponentProps";
import { createContextWithMandatoryProvider } from "../../common/UseContextWithMandatoryProvider";
import type { PropertyUpdatedArgs } from "../../editors/EditorContainer";
import type { ActionButtonRenderer } from "../../properties/renderers/ActionButtonRenderer";
import type { PropertyGridColumnInfo } from "../../properties/renderers/PropertyGridColumns";
import type { PropertyValueRendererManager } from "../../properties/ValueRendererManager";
import { FilteredType } from "../dataproviders/filterers/PropertyDataFiltererBase";
import type { FlatGridItem, GridCategoryItem } from "../internal/flat-items/FlatGridItem";
import { MutableCategorizedPrimitiveProperty } from "../internal/flat-items/MutableCategorizedPrimitiveProperty";
import { MutableCustomGridCategory } from "../internal/flat-items/MutableCustomGridCategory";
import { FlatGridItemType } from "../internal/flat-items/MutableFlatGridItem";
import { MutableGridCategory } from "../internal/flat-items/MutableGridCategory";
import { FlatPropertyRenderer } from "../internal/flat-properties/FlatPropertyRenderer";
import type { IPropertyGridEventHandler } from "../internal/PropertyGridEventHandler";
import type { IPropertyGridModel } from "../internal/PropertyGridModel";
import type { PropertyCategoryRendererProps } from "../PropertyCategoryRendererManager";
import { PropertyCategoryRendererManager } from "../PropertyCategoryRendererManager";
import type { IPropertyDataProvider, PropertyCategory } from "../PropertyDataProvider";
import { ColumnResizingPropertyListPropsSupplier } from "./ColumnResizingPropertyListPropsSupplier";
import { FlatItemNestedBorderWrapper } from "./FlatItemNestedBorderWrapper";
import { PropertyCategoryBlock } from "./PropertyCategoryBlock";
import type { CommonPropertyGridProps} from "./PropertyGridCommons";
import { PropertyGridCommons } from "./PropertyGridCommons";
import { PropertyGridEventsRelatedPropsSupplier } from "./PropertyGridEventsRelatedPropsSupplier";

/** Properties for [[VirtualizedPropertyGrid]] React component
 * @beta
 */
export interface VirtualizedPropertyGridProps extends CommonPropertyGridProps {
  model: IPropertyGridModel;
  eventHandler: IPropertyGridEventHandler;
  dataProvider: IPropertyDataProvider;
  highlight?: HighlightingComponentProps & {
    filteredTypes?: FilteredType[];
  };
  propertyCategoryRendererManager?: PropertyCategoryRendererManager;
  width: number;
  height: number;
}

/** State of [[VirtualizedPropertyGrid]] React component
 * @internal
 */
interface VirtualizedPropertyGridState {
  /** List of PropertyGrid categories */
  gridItems: FlatGridItem[];
  /** Actual orientation used by the property grid */
  orientation: Orientation;
  /** Keeps record of dynamic node heights */
  dynamicNodeHeights: Map<string, number>;
  /** When resetting node height cache, marks the point at which heights have become stale */
  resetIndex: number;
}

/**
 * Context of [[VirtualizedPropertyGrid]] component.
 * @internal
 */
export interface PropertyGridInternalContext {
  gridItems: FlatGridItem[];
  gridEventHandler: IPropertyGridEventHandler;
  gridModel: IPropertyGridModel;

  style?: React.CSSProperties;
  className?: string;
  gridContext: VirtualizedPropertyGridContext;
  onItemHeightChanged: (index: number, key: string, height: number) => void;
}

/**
 * Context of the surrounding [VirtualizedPropertyGrid]($components-react) component.
 * @beta
 */
export interface VirtualizedPropertyGridContext {
  orientation: Orientation;
  gridWidth: number;

  isPropertyHoverEnabled: boolean;
  isPropertySelectionEnabled: boolean;
  selectedPropertyKey?: string;

  onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyRightClicked?: (property: PropertyRecord, key?: string) => void;
  onPropertyContextMenu?: (property: PropertyRecord, e: React.MouseEvent) => void;

  editingPropertyKey?: string;
  onEditCommit?: (args: PropertyUpdatedArgs, category: PropertyCategory) => void;
  onEditCancel?: () => void;

  eventHandler: IPropertyGridEventHandler;
  dataProvider: IPropertyDataProvider;

  actionButtonRenderers?: ActionButtonRenderer[];
  propertyValueRendererManager?: PropertyValueRendererManager;
  propertyCategoryRendererManager?: PropertyCategoryRendererManager;

  columnRatio: number;
  columnInfo: PropertyGridColumnInfo;
  isResizeHandleBeingDragged: boolean;
  isResizeHandleHovered: boolean;
  onColumnRatioChanged: (ratio: number) => void | RatioChangeResult;
  onResizeHandleDragChanged: (newValue: boolean) => void;
  onResizeHandleHoverChanged: (newValue: boolean) => void;

  highlight?: HighlightingComponentProps & {
    filteredTypes?: FilteredType[];
  };
}

const [
  PropertyGridInternalContextProvider,
  _PropertyGridInternalContextConsumer,
  usePropertyGridInternalContext,
] = createContextWithMandatoryProvider<PropertyGridInternalContext>("PropertyGridInternalContext");

/**
 * VirtualizedPropertyGrid React component.
 * @beta
 */
export class VirtualizedPropertyGrid extends React.Component<VirtualizedPropertyGridProps, VirtualizedPropertyGridState> {
  private _listRef = React.createRef<VariableSizeList>();

  /** @internal */
  constructor(props: VirtualizedPropertyGridProps) {
    super(props);
    this.state = {
      gridItems: [],
      orientation: props.orientation ?? Orientation.Horizontal,
      dynamicNodeHeights: new Map(),
      resetIndex: 0,
    };
  }

  /** @internal */
  public override componentDidUpdate(prevProps: VirtualizedPropertyGridProps, prevState: VirtualizedPropertyGridState) {
    if (this.props.orientation !== prevProps.orientation
      || this.props.isOrientationFixed !== prevProps.isOrientationFixed
      || this.props.horizontalOrientationMinWidth !== prevProps.horizontalOrientationMinWidth
      || this.props.width !== prevProps.width)
      this.updateOrientation(this.props.width);

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

    if (this.state.dynamicNodeHeights !== prevState.dynamicNodeHeights) {
      // istanbul ignore else
      if (this._listRef.current)
        this._listRef.current.resetAfterIndex(this.state.resetIndex);
    }
  }

  /** @internal */
  public static getDerivedStateFromProps(props: VirtualizedPropertyGridProps, state: VirtualizedPropertyGridState): VirtualizedPropertyGridState | null {
    return {
      ...state,
      gridItems: props.model.getVisibleFlatGrid(),
    };
  }

  private updateOrientation(width: number) {
    const { orientation, isOrientationFixed, horizontalOrientationMinWidth } = { ...this.props };
    const currentOrientation = PropertyGridCommons.getCurrentOrientation(width, orientation, isOrientationFixed, horizontalOrientationMinWidth);

    if (currentOrientation !== this.state.orientation) {
      this.setState({ orientation: currentOrientation });
      // istanbul ignore else
      if (this._listRef.current)
        this._listRef.current.resetAfterIndex(0);
    }
  }

  /**
   * Calculate given node height depending on it's type, position in category, parent category depth and current orientation.
   * @param node FlatGridItem node for which to calculate height
   * @returns current height of node.
   */
  private calculateNodeHeight(node: FlatGridItem) {
    const categoryHeaderHeight = 35;
    const categoryHeaderPadding = 4;
    const categoryPropertyHeight = 27;
    const bottomBorderPadding = 5;
    const verticalPrimitivePropertyHeight = 55;

    return getPropertyHeight(this.state) + node.lastInNumberOfCategories * bottomBorderPadding;

    function getPropertyHeight(state: VirtualizedPropertyGridState) {
      const dynamicHeight = state.dynamicNodeHeights.get(node.key);
      if (dynamicHeight !== undefined) {
        if (node instanceof MutableCustomGridCategory) {
          return categoryHeaderHeight + categoryHeaderPadding
            + (node.isExpanded ? dynamicHeight + bottomBorderPadding : 0);
        }

        return dynamicHeight + (state.orientation === Orientation.Vertical ? 28 : 0);
      }

      if (node.type === FlatGridItemType.Category) {
        return categoryHeaderHeight + categoryHeaderPadding;
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

    this.setState((state) => {
      return {
        ...state,
        dynamicNodeHeights: new Map(state.dynamicNodeHeights).set(key, newHeight),
        resetIndex: index,
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
  public override render() {
    return <ColumnResizingPropertyListPropsSupplier
      orientation={this.state.orientation}
      width={this.props.width}
      minLabelWidth={this.props.minLabelWidth}
      minValueWidth={this.props.minValueWidth}
      actionButtonWidth={this.props.actionButtonWidth}
    >
      {(columnResizeContext) => (
        <PropertyGridEventsRelatedPropsSupplier
          isPropertySelectionEnabled={this.props.isPropertySelectionEnabled ?? false}
          isPropertySelectionOnRightClickEnabled={this.props.isPropertySelectionOnRightClickEnabled}
          isPropertyEditingEnabled={this.props.isPropertyEditingEnabled}
          onPropertyContextMenu={this.props.onPropertyContextMenu}
          onPropertyUpdated={this.props.onPropertyUpdated}
          onPropertySelectionChanged={this.props.onPropertySelectionChanged}
          isPropertyHoverEnabled={this.props.isPropertyHoverEnabled ?? false}
        >
          {(selectionContext) => {
            const gridContext: VirtualizedPropertyGridContext = {
              orientation: columnResizeContext.orientation,
              gridWidth: this.props.width,

              isPropertyHoverEnabled: selectionContext.isPropertyHoverEnabled,
              isPropertySelectionEnabled: selectionContext.isPropertySelectionEnabled,
              selectedPropertyKey: selectionContext.selectedPropertyKey,

              onPropertyClicked: selectionContext.onPropertyClicked,
              onPropertyRightClicked: selectionContext.onPropertyRightClicked,
              onPropertyContextMenu: selectionContext.onPropertyContextMenu,

              editingPropertyKey: selectionContext.editingPropertyKey,
              onEditCommit: selectionContext.onEditCommit,
              onEditCancel: selectionContext.onEditCancel,

              eventHandler: this.props.eventHandler,
              dataProvider: this.props.dataProvider,

              actionButtonRenderers: this.props.actionButtonRenderers,
              propertyValueRendererManager: this.props.propertyValueRendererManager,
              propertyCategoryRendererManager: this.props.propertyCategoryRendererManager,

              columnRatio: columnResizeContext.columnRatio,
              columnInfo: columnResizeContext.columnInfo,
              isResizeHandleBeingDragged: columnResizeContext.isResizeHandleBeingDragged,
              isResizeHandleHovered: columnResizeContext.isResizeHandleHovered,
              onColumnRatioChanged: columnResizeContext.onColumnChanged,
              onResizeHandleDragChanged: columnResizeContext.onResizeHandleDragChanged,
              onResizeHandleHoverChanged: columnResizeContext.onResizeHandleHoverChanged,

              highlight: this.props.highlight,
            };

            const renderContext: PropertyGridInternalContext = {
              gridItems: this.state.gridItems,
              gridEventHandler: this.props.eventHandler,
              gridModel: this.props.model,
              style: this.props.style,
              className: this.props.className,
              onItemHeightChanged: this._handleNodeHeightChange,
              gridContext,
            };

            return (
              <PropertyGridInternalContextProvider value={renderContext}>
                <div className={classnames("components-virtualized-property-grid", "components-smallEditor-host")}>
                  <VariableSizeList
                    className={classnames("components-property-grid-wrapper", "ReactWindow__VariableSizeList", this.props.className)}
                    width={this.props.width}
                    height={this.props.height}
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
              </PropertyGridInternalContextProvider>
            );
          }}
        </PropertyGridEventsRelatedPropsSupplier >
      )}
    </ColumnResizingPropertyListPropsSupplier>;
  }
}

const FlatGridItemNode = React.memo(
  ({ index, style: virtualizedListStyle }: ListChildComponentProps) => {
    const { gridItems, gridEventHandler, gridModel, gridContext, className, style, onItemHeightChanged } = usePropertyGridInternalContext(FlatGridItemNode);
    const node = gridItems[index];

    const onExpansionToggled = React.useCallback(
      () => gridEventHandler.onExpansionToggled(node.selectionKey),
      [gridEventHandler, node.selectionKey],
    );
    const onHeightChanged = React.useCallback(
      (newHeight: number) => onItemHeightChanged(index, node.key, newHeight),
      [onItemHeightChanged, index, node.key],
    );

    function getDisplayNode() {
      const lastInNumberOfCategories = node.lastInNumberOfCategories;
      switch (node.type) {
        case FlatGridItemType.Category:
          const categoryRendererManager = gridContext.propertyCategoryRendererManager
            ?? PropertyCategoryRendererManager.defaultManager;
          const customRenderer = categoryRendererManager.getCategoryComponent(node);
          const wrapperClassName = classnames(
            "virtualized-grid-node-content",
            customRenderer !== undefined ? "virtualized-grid-node-custom-category" : "virtualized-grid-node-category",
          );
          return (
            <FlatItemNestedBorderWrapper
              borderCount={node.depth}
              bottomBorderCount={lastInNumberOfCategories}
              className={wrapperClassName}
            >
              <PropertyCategoryBlock
                className={className}
                style={style}
                category={node.derivedCategory}
                onExpansionToggled={onExpansionToggled}
                highlight={gridContext.highlight?.filteredTypes?.includes(FilteredType.Category) ?
                  gridContext.highlight :
                  undefined
                }
              >
                {customRenderer !== undefined && (
                  <CustomCategoryContent
                    renderer={customRenderer}
                    categoryItem={node}
                    gridContext={gridContext}
                    onHeightChanged={onHeightChanged}
                  />
                )}
              </PropertyCategoryBlock>
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
                width={gridContext.gridWidth}

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
                onColumnRatioChanged={gridContext.onColumnRatioChanged}
                onResizeHandleDragChanged={gridContext.onResizeHandleDragChanged}
                onResizeHandleHoverChanged={gridContext.onResizeHandleHoverChanged}

                highlight={gridContext.highlight ?
                  { applyOnLabel: (gridContext.highlight.filteredTypes?.includes(FilteredType.Label)) ?? false, applyOnValue: (gridContext.highlight.filteredTypes?.includes(FilteredType.Value)) ?? false, ...gridContext.highlight } :
                  undefined
                }
              />
            </FlatItemNestedBorderWrapper>
          );
      }
    }

    return (
      <div className="virtualized-grid-node" style={virtualizedListStyle}>
        {getDisplayNode()}
      </div>
    );
  },
  areEqual,
);

FlatGridItemNode.displayName = "FlatGridItemNode";

interface CustomCategoryContentProps {
  categoryItem: GridCategoryItem;
  renderer: React.ComponentType<PropertyCategoryRendererProps>;
  gridContext: VirtualizedPropertyGridContext;
  onHeightChanged: (newHeight: number) => void;
}

const CustomCategoryContent: React.FC<CustomCategoryContentProps> = (props) => {
  const { onHeightChanged } = props;
  const divRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(
    () => {
      assert(divRef.current !== null);
      const contentHeight = divRef.current.getBoundingClientRect().height;
      onHeightChanged(contentHeight);
    },
    [props.gridContext.orientation, onHeightChanged],
  );

  return (
    <div ref={divRef}>
      {React.createElement(props.renderer, props)}
    </div>
  );
};
