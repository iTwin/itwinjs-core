# Table

The [Table]($ui-components:Table) category in the `@bentley/ui-components` package includes
classes and components for working with a Table control.

## Components

The following React components comprise the Table control.

- [Table]($ui-components) - renders data rows and columns in a grid along with a header
- [TableCell]($ui-components) - renders a table cell
- [TableCellContent]($ui-components) - renders table cell content

There are a number of value renderer components for different types that can be found in the [Properties]($ui-components:Properties) category.
Those components are managed by the [PropertyValueRendererManager]($ui-components).

**Note**: The Table component uses various components from the [react-data-grid](https://www.npmjs.com/package/react-data-grid) package internally.

## Data Provider

The Table data provider is defined by the [TableDataProvider]($ui-components) interface and
provides information about the columns and rows to the Table component.

The `getColumns` method retrieves an array of [ColumnDescription]($ui-components).
The `getRowsCount` method retrieves the number of rows and
the `getRow` method retrieves a specific [RowItem]($ui-components) by index.

The `onColumnsChanged` event should be emitted when column data changes.
The `onRowsChanged` event should be emitted when row data changes.

The `sort` method sorts the rows based on the value in a specific column.

For filtering support, the `applyFilterDescriptors` applies a filter descriptor collection and
`getDistinctValues` gets the distinct values in a column.

### Column Description

Column definitions are defined by the [ColumnDescription]($ui-components) interface.

The `key` member is a unique key for the column.
The `label` member is a column header label.

The `propertyDescription` member is a [PropertyDescription]($ui-abstract) for all cells in the column.

The `editable` member indicates whether the cells in the column are editable.
The `resizable` member indicates whether the column is resizable.
The `sortable` member indicates whether the column is sortable.

The `filterable` member indicates whether the column is filterable.
The `filterRenderer` member specifies the [FilterRenderer]($ui-components) for the column.

### Row Item

Row information is defined by the [RowItem]($ui-components) interface.

The `key` member is a unique key for the row.
The `cells` member is an array of [CellItem]($ui-components) in the row.

The `isDisabled` member indicates whether the cells in the row are disabled.
The `colorOverrides` member specifies color overrides via the [ItemColorOverrides]($ui-components) interface.

### Cell Item

Cell information is defined by the [CellItem]($ui-components) interface.

The `key` member is the key for the column containing the cell.
The `record` member is the [PropertyRecord]($ui-abstract) for the cell.

The `isDisabled` member indicates whether the cell is disabled.
The `alignment` member specifies the horizontal alignment of the contents of the cell and
the `style` member specifies style properties for the contents of the cell.

### Data Provider Implementations

The [SimpleTableDataProvider]($ui-components) class is an implementation of
TableDataProvider that uses an array.
The [PresentationTableDataProvider]($presentation-components) class is a
Presentation Rules-driven implementation.
Developers may develop their own implementation of TableDataProvider.

## Properties

The Table component properties are defined in the [TableProps]($ui-components) interface.

The `dataProvider` prop, which is the only mandatory prop, specifies the Table data provider.

The `pageAmount` prop specifies the amount of rows per page. The default is 100.
The `onRowsLoaded` prop specifies a callback function called when rows are loaded.

For selection support, the `selectionMode` prop specifies the desired [SelectionMode]($ui-components)
and the `tableSelectionTarget` prop specifies the desired [TableSelectionTarget]($ui-components).
There are a number of selection related callback functions:

- isRowSelected - Callback for determining if row is selected
- onRowsSelected - Callback for when rows are selected
- onRowsDeselected - Callback for when rows are deselected
- isCellSelected - Callback for determining if cell is selected
- onCellsSelected - Callback for when cells are selected
- onCellsDeselected - Callback for when cells are deselected

For cell editing support, the `onPropertyUpdated` callback function is called when properties are updated.
The `ColumnDescription.editable` member should be set to true to enable cell editing.

The `reorderableColumns` prop indicates whether the Table columns are reorderable.
The `showHideColumns` prop enables a context menu to show/hide columns.
The `hideHeader` prop hides the Table header.

## Sample using Presentation Rules

### Simple Table Component

This React component utilizes the [Table]($ui-components) component and
[tableWithUnifiedSelection]($presentation-components) HOC to
create a HOC table component that supports unified selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Table } from "@bentley/ui-components";
import { PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";

// create a HOC table component that supports unified selection
// eslint-disable-next-line @typescript-eslint/naming-convention
const SimpleTable = tableWithUnifiedSelection(Table);

/** React properties for the table component */
export interface Props {
  /** iModel whose contents should be displayed in the table */
  imodel: IModelConnection;
  /** ID of the presentation rule set to use for creating the content displayed in the table */
  rulesetId: string;
}

/** Table component for the viewer app */
export default class SimpleTableComponent extends React.Component<Props> {
  public render() {
    return (
      <SimpleTable dataProvider={new PresentationTableDataProvider({ imodel: this.props.imodel, ruleset: this.props.rulesetId })} />
    );
  }
}
```

### Using the SimpleTableComponent component

```tsx
const rulesetId = "Default";
. . .
<SimpleTableComponent imodel={this.props.imodel} rulesetId={rulesetId} />
```

## API Reference

- [Table in @bentley/ui-components]($ui-components:Table)
- [Properties in @bentley/ui-components]($ui-components:Properties)
- [Properties in @bentley/ui-abstract]($ui-abstract:Properties)
