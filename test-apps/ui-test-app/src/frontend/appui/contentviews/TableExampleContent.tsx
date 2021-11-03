/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import {
  DateFormatter, Primitives, PropertyRecord, PropertyValue, StandardTypeNames,
} from "@itwin/appui-abstract";
import {
  ColumnDescription, LessGreaterOperatorProcessor,
  PropertyUpdatedArgs, SelectionMode, Table, TableCellContextMenuArgs, TableCellUpdatedArgs, TableDataProvider, TableSelectionTarget, TypeConverter, TypeConverterManager,
} from "@itwin/components-react";
import { ConfigurableCreateInfo, ConfigurableUiManager, ContentControl, WidgetControl } from "@itwin/appui-react";
import { Input, Select, SelectOption, ToggleSwitch } from "@itwin/itwinui-react";
import { BodyText, Gap } from "@itwin/core-react";
import { TableExampleData } from "./TableExampleData";

class TableExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <TableExampleContent />;
  }
}

export class TableExampleWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <TableExampleContent />;
  }
}

interface TableExampleState {
  dataProvider?: TableDataProvider;
  selectionMode: SelectionMode;
  tableSelectionTarget: TableSelectionTarget;
  selectedIndexes: any[];
  requestedTopRow: number;
  topRow: number;
  filtering: boolean;
  useUtc: boolean;
}

export class TableExampleContent extends React.Component<{}, TableExampleState>  {
  public override readonly state: Readonly<TableExampleState>;
  private _tableExampleData = new TableExampleData();

  constructor(props: any) {
    super(props);

    this.state = {
      selectedIndexes: [],
      selectionMode: SelectionMode.Single,
      tableSelectionTarget: TableSelectionTarget.Row,
      requestedTopRow: 0,
      topRow: 0,
      filtering: true,
      useUtc: false,
    };
  }

  private loadData(useUtc: boolean) {
    this._tableExampleData.loadData(useUtc);

    const dataProvider = this._tableExampleData.dataProvider;
    this.setState({ dataProvider });
  }

  public override componentDidMount() {
    this.loadData(this.state.useUtc);
  }

  private _onChangeSelectionMode = (newValue: SelectionMode) => {
    this.setState({ selectionMode: newValue });
  };

  private _onChangeTableSelectionTarget = (newValue: TableSelectionTarget) => {
    this.setState({ tableSelectionTarget: newValue });
  };

  private _updatePropertyRecord(record: PropertyRecord, newValue: PropertyValue): PropertyRecord {
    return record.copyWithNewValue(newValue);
  }

  private _handlePropertyUpdated = async (propertyArgs: PropertyUpdatedArgs, cellArgs: TableCellUpdatedArgs): Promise<boolean> => {
    let updated = false;

    if (propertyArgs.propertyRecord) {
      propertyArgs.propertyRecord = this._updatePropertyRecord(propertyArgs.propertyRecord, propertyArgs.newValue);
      if (cellArgs.rowIndex >= 0) {
        const rowItem = await this.state.dataProvider!.getRow(cellArgs.rowIndex);
        if (rowItem) {
          const cellItem = rowItem.cells.find((cell) => cell.key === cellArgs.cellKey);
          if (cellItem) {
            cellItem.record = propertyArgs.propertyRecord;
            updated = true;
          }
        }
      }
    }

    return updated;
  };

  private _onRequestedTopRowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let requestedTopRow = 0;
    if (e.target.value)
      requestedTopRow = parseInt(e.target.value, 10);
    this.setState({ requestedTopRow });
  };

  private _onScrollToRow = (topRowIndex: number) => {
    this.setState({ topRow: topRowIndex });
  };

  private _handleCellContextMenu = (args: TableCellContextMenuArgs) => {
    // eslint-disable-next-line no-console
    console.log(`rowIndex ${args.rowIndex}, colIndex ${args.colIndex}, cellKey ${args.cellKey}`);
  };

  private _onUtcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    this.setState({ useUtc: checked });
    this.loadData(checked);
  };

  private _onFilteringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    this.setState({ filtering: checked });
    this._tableExampleData.columns.forEach((column: ColumnDescription) => {
      column.filterable = checked;
    });
    if (this.state.dataProvider) {
      this.state.dataProvider.onColumnsChanged.raiseEvent();
      this.state.dataProvider.onRowsChanged.raiseEvent();
    }
  };

  private _selectionModes: SelectOption<SelectionMode>[] = [
    { value: SelectionMode.Single, label: "Single" },
    { value: SelectionMode.SingleAllowDeselect, label: "Single Allow Deselect" },
    { value: SelectionMode.Multiple, label: "Multiple" },
    { value: SelectionMode.Extended, label: "Extended" },
  ];

  private _selectionTargets: SelectOption<TableSelectionTarget>[] = [
    { value: TableSelectionTarget.Row, label: "Row" },
    { value: TableSelectionTarget.Cell, label: "Cell" },
  ];

  public override render(): React.ReactNode {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexFlow: "column" }}>
        <div style={{ display: "flex", alignItems: "center", height: "32px" }}>
          <Select onChange={this._onChangeSelectionMode} aria-label="Selection Mode" value={this.state.selectionMode} options={this._selectionModes} size="small" />
          <Gap />
          <Select onChange={this._onChangeTableSelectionTarget} aria-label="Selection Target" value={this.state.tableSelectionTarget} options={this._selectionTargets} size="small" />
          <Gap />
          <label>
            <BodyText>Top row:</BodyText>
            &nbsp;
            <Input onChange={this._onRequestedTopRowChange} style={{ width: "100px" }} size="small" />
            &nbsp;
            <span>({this.state.topRow})</span>
          </label>
          <Gap />
          <label style={{ display: "flex" }}>
            <BodyText>Filtering:</BodyText>
            &nbsp;
            <ToggleSwitch checked={this.state.filtering} onChange={this._onFilteringChange} title="Filtering" />
          </label>
          <Gap />
          <label style={{ display: "flex" }}>
            <BodyText>UTC:</BodyText>
            &nbsp;
            <ToggleSwitch checked={this.state.useUtc} onChange={this._onUtcChange} title="Use UTC in lieu of local time" />
          </label>
        </div>
        <div style={{ flex: "1", height: "calc(100% - 32px)" }}>
          {this.state.dataProvider &&
            <Table
              dataProvider={this.state.dataProvider}
              tableSelectionTarget={this.state.tableSelectionTarget}
              selectionMode={this.state.selectionMode}
              onPropertyUpdated={this._handlePropertyUpdated}
              scrollToRow={this.state.requestedTopRow}
              onScrollToRow={this._onScrollToRow}
              onCellContextMenu={this._handleCellContextMenu}
              stripedRows={true}
            />}
        </div>
      </div>
    );
  }
}

ConfigurableUiManager.registerControl("TableExampleContent", TableExampleContentControl);

/** An example formatter that both formats and parses dates. */
class MdyFormatter implements DateFormatter {
  private _formatter = new Intl.DateTimeFormat(undefined,
    {
      year: "numeric",    /* "2-digit", "numeric" */
      month: "2-digit",   /* "2-digit", "numeric", "narrow", "short", "long" */
      day: "2-digit",     /* "2-digit", "numeric" */
    });

  public formateDate(date: Date) {
    const formatParts = this._formatter.formatToParts(date);
    const month = formatParts.find((part) => part.type === "month")!.value;
    const day = formatParts.find((part) => part.type === "day")!.value;
    const year = formatParts.find((part) => part.type === "year")!.value;
    return `${month}-${day}-${year}`;
  }

  public parseDate(dateString: string) {
    const mdy = dateString.split("-").filter((value) => !!value);
    if (mdy.length !== 3) return undefined;
    const month = parseInt(mdy[0], 10);
    const day = parseInt(mdy[1], 10);
    const year = parseInt(mdy[2], 10);

    // validate
    if (isNaN(month) || month < 0 || month > 12) return undefined;
    if (isNaN(day) || day < 0 || day > 31) return undefined;
    if (isNaN(year) || year < 1800 || year > 2300) return undefined;

    return new Date(year, month - 1, day);
  }
}

/**
 * Custom Date Time Type Converter.
 */
class MmDdYyyDateTypeConverter extends TypeConverter implements LessGreaterOperatorProcessor {
  private _formatter = new MdyFormatter();

  public override convertToString(value?: Primitives.Value) {
    if (value === undefined)
      return "";

    if (typeof value === "string")
      value = new Date(value);

    if (value instanceof Date) {
      return this._formatter.formateDate(value);
    }

    return value.toString();
  }

  public override convertFromString(value: string) {
    if (!value)
      return undefined;

    return this._formatter.parseDate(value);
  }

  public override get isLessGreaterType(): boolean { return true; }

  public sortCompare(valueA: Date, valueB: Date, _ignoreCase?: boolean): number {
    return valueA.valueOf() - valueB.valueOf();
  }

  public override isEqualTo(valueA: Date, valueB: Date): boolean {
    return valueA.valueOf() === valueB.valueOf();
  }

  public override isNotEqualTo(valueA: Date, valueB: Date): boolean {
    return valueA.valueOf() !== valueB.valueOf();
  }

  public isLessThan(a: Date, b: Date): boolean {
    return a.valueOf() < b.valueOf();
  }

  public isLessThanOrEqualTo(a: Date, b: Date): boolean {
    return a.valueOf() <= b.valueOf();
  }

  public isGreaterThan(a: Date, b: Date): boolean {
    return a.valueOf() > b.valueOf();
  }

  public isGreaterThanOrEqualTo(a: Date, b: Date): boolean {
    return a.valueOf() >= b.valueOf();
  }
}

TypeConverterManager.registerConverter(StandardTypeNames.ShortDate, MmDdYyyDateTypeConverter, "mm-dd-yyyy");
