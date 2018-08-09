/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ContentControl } from "@bentley/ui-framework";
import {
  PropertyDescription, Table,
  ColumnDescription, RowItem, TableDataProvider, SimpleTableDataProvider, PropertyValueFormat, PropertyRecord,
} from "@bentley/ui-components";

class TableExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TableExampleContent />;
  }
}

interface TableExampleState {
  dataProvider: TableDataProvider;
  selectedIndexes: any[];
}

class TableExampleContent extends React.Component<{}, TableExampleState>  {
  public readonly state: Readonly<TableExampleState>;

  constructor(props: any) {
    super(props);

    const column1Desc: PropertyDescription = {
      name: "column1",
      displayLabel: "Column 1 Label",
      typename: "int",
    };

    const columns: ColumnDescription[] = [
      {
        key: "id",
        label: "ID",
        resizable: true,
        sortable: true,
        propertyDescription: column1Desc,
      },
      {
        key: "title",
        label: "Title",
        sortable: true,
        resizable: true,
      },
      {
        key: "more",
        label: "More Data",
        sortable: true,
        resizable: false,
      },
    ];

    const rows = new Array<RowItem>();
    for (let i = 1; i <= 100000; i++) {
      rows.push({
        key: i,
        cells: [
          {
            key: "id",
            record: new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: i, displayValue: i.toString() },
              column1Desc,
            ),
          },
          {
            key: "title",
            record: "Title " + i,
          },
          {
            key: "more",
            record: "More Data - " + i,
          },
        ],
      });
    }

    const dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);

    this.state = { dataProvider, selectedIndexes: [] };
  }

  public render(): React.ReactNode {
    return (
      <Table dataProvider={this.state.dataProvider} />
    );
  }
}

ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);
