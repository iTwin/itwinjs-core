/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export { UiComponents } from "./ui-components/UiComponents";

export * from "./ui-components/breadcrumb/Breadcrumb";
export * from "./ui-components/breadcrumb/BreadcrumbPath";
export * from "./ui-components/breadcrumb/BreadcrumbTreeUtils";
export { BreadcrumbDragDropProps, withBreadcrumbDragDrop } from "./ui-components/breadcrumb/hoc/withDragDrop";
export * from "./ui-components/breadcrumb/breadcrumbdetails/BreadcrumbDetails";
export { BreadcrumbDetailsDragDropProps, withBreadcrumbDetailsDragDrop } from "./ui-components/breadcrumb/breadcrumbdetails/hoc/withDragDrop";

export { PageOptions } from "./ui-components/common/PageOptions";
export { SelectionMode } from "./ui-components/common/selection/SelectionModes";
export { SelectionHandler } from "./ui-components/common/selection/SelectionHandler";
export * from "./ui-components/common/showhide/ShowHideDialog";
export * from "./ui-components/common/showhide/ShowHideItem";
export * from "./ui-components/common/showhide/ShowHideMenu";

export * from "./ui-components/converters/TypeConverter";
export * from "./ui-components/converters/TypeConverterManager";
export * from "./ui-components/converters/BooleanTypeConverter";
export * from "./ui-components/converters/DateTimeTypeConverter";
export * from "./ui-components/converters/EnumTypeConverter";
export * from "./ui-components/converters/HexadecimalTypeConverter";
export * from "./ui-components/converters/NavigationPropertyTypeConverter";
export * from "./ui-components/converters/NumericTypeConverter";
export * from "./ui-components/converters/PointTypeConverter";
export * from "./ui-components/converters/StringTypeConverter";

import * as ConvertedPrimitives from "./ui-components/converters/valuetypes/ConvertedTypes";
export { ConvertedPrimitives };

export * from "./ui-components/dragdrop/DragDropDef";
export * from "./ui-components/dragdrop/withDragSource";
export * from "./ui-components/dragdrop/withDropTarget";
export * from "./ui-components/dragdrop/BeDragDropContext";

export * from "./ui-components/editors/EditorContainer";
export * from "./ui-components/editors/PropertyEditorManager";
export * from "./ui-components/editors/TextEditor";
export * from "./ui-components/editors/EnumEditor";
export * from "./ui-components/editors/EnumButtonGroupEditor";
export * from "./ui-components/editors/BooleanEditor";
export * from "./ui-components/editors/ToggleEditor";

export * from "./ui-components/filtering/FilteringInput";
export * from "./ui-components/filtering/ResultSelector";

export * from "./ui-components/properties/ValueRendererManager";

export * from "./ui-components/properties/renderers/NonPrimitivePropertyRenderer";
export * from "./ui-components/properties/renderers/PrimitivePropertyRenderer";
export * from "./ui-components/properties/renderers/PropertyRenderer";
export * from "./ui-components/properties/renderers/PropertyView";

export * from "./ui-components/properties/renderers/label/NonPrimitivePropertyLabelRenderer";
export * from "./ui-components/properties/renderers/label/PrimitivePropertyLabelRenderer";

export * from "./ui-components/properties/renderers/value/PrimitivePropertyValueRenderer";
export * from "./ui-components/properties/renderers/value/ArrayPropertyValueRenderer";
export * from "./ui-components/properties/renderers/value/StructPropertyValueRenderer";
export * from "./ui-components/properties/renderers/value/DoublePropertyValueRenderer";
export * from "./ui-components/properties/renderers/value/NavigationPropertyValueRenderer";
export * from "./ui-components/properties/renderers/value/table/ArrayValueRenderer";
export * from "./ui-components/properties/renderers/value/table/StructValueRenderer";
export * from "./ui-components/properties/renderers/value/table/NonPrimitiveValueRenderer";
export * from "./ui-components/properties/ItemStyle";

export * from "./ui-components/propertygrid/PropertyDataProvider";
export * from "./ui-components/propertygrid/SimplePropertyDataProvider";
export * from "./ui-components/propertygrid/component/PropertyGrid";
export * from "./ui-components/propertygrid/component/PropertyCategoryBlock";
export * from "./ui-components/color/Swatch";
export * from "./ui-components/color/HueSlider";
export * from "./ui-components/color/AlphaSlider";
export * from "./ui-components/color/SaturationPicker";
export * from "./ui-components/color/ColorPickerButton";

export * from "./ui-components/table/TableDataProvider";
export * from "./ui-components/table/SimpleTableDataProvider";
export { Table, TableProps, TableSelectionTarget } from "./ui-components/table/component/Table";
export { TableCellEditorState, TableCellUpdatedArgs } from "./ui-components/table/component/Table";
export { TableDragDropType, TableDropTargetProps, TableDragDropProps, withTableDragDrop } from "./ui-components/table/hocs/withDragDrop";

export * from "./ui-components/tree/TreeDataProvider";
export * from "./ui-components/tree/HighlightingEngine";
export { Tree, TreeProps } from "./ui-components/tree/component/Tree";
export { TreeCellUpdatedArgs } from "./ui-components/tree/CellEditingEngine";
export { TreeDragDropType, TreeDragDropProps, withTreeDragDrop } from "./ui-components/tree/hocs/withDragDrop";
export { SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy } from "./ui-components/tree/SimpleTreeDataProvider";

export * from "./ui-components/viewport/ViewportComponent";
export * from "./ui-components/viewport/ViewportComponentEvents";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("ui-components", BUILD_SEMVER);
}

/** @docs-package-description
 * The ui-components package contains React components that are data-oriented, such as PropertyGrid, Table, Tree and Breadcrumb.
 * For more information, see [learning about ui-components]($docs/learning/components/index.md).
 */
/**
 * @docs-group-description Common
 * Common classes used across various UI components.
 */
/**
 * @docs-group-description Breadcrumb
 * Classes for working with a Breadcrumb.
 */
/**
 * @docs-group-description Color
 * Classes for working with and picking a Color.
 */
/**
 * @docs-group-description DragDrop
 * Classes and Higher Order Components for working with the DragDrop API.
 */
/**
 * @docs-group-description Filtering
 * Classes for working with filtering.
 */
/**
 * @docs-group-description Properties
 * Classes for working with Properties.
 */
/**
 * @docs-group-description PropertyEditors
 * Classes for working with Property Editors.
 */
/**
 * @docs-group-description PropertyGrid
 * Classes for working with a PropertyGrid.
 */
/**
 * @docs-group-description Table
 * Classes for working with a Table.
 */
/**
 * @docs-group-description Tree
 * Classes for working with a Tree.
 */
/**
 * @docs-group-description TypeConverters
 * Classes for working with Type Converters.
 */
/**
 * @docs-group-description Viewport
 * Classes for working with a Viewport.
 */
