# Table

The [Table]($ui-components:Table) category in the `@bentley/ui-components` package includes
classes and components for working with a Table control.

## Components and Properties

TODO

## Sample using Presentation Rules

### Simple Table Component

This React component utilizes the [Table]($ui-components) component and
[tableWithUnifiedSelection]$(presentation-components) HOC to
create a HOC table component that supports unified selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Table } from "@bentley/ui-components";
import { PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";

// create a HOC table component that supports unified selection
// tslint:disable-next-line:variable-name
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

## Sample using SimpleTableDataProvider

TODO

## API Reference

* [Table]($ui-components:Table)
