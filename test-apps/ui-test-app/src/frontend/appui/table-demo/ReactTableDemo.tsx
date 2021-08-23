/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Column, TableState } from "react-table";
import { Table } from "@itwin/itwinui-react";
import { ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { TableExampleData } from "../contentviews/TableExampleData";
import { TableDataProviderAdapter } from "./TableDataProviderAdapter";

export interface ReactTableDemoProps {
  isSortable?: boolean;
}

export function ReactTableDemo(args: ReactTableDemoProps) {
  const tableExampleData = React.useMemo(() => new TableExampleData(), []);
  const providerAdapter = React.useRef<TableDataProviderAdapter>();
  const [fetchedData, setFetchedData] = React.useState<Record<string, unknown>[]>(() => []);
  const [fetchedColumns, setFetchedColumns] = React.useState<Column<Record<string, unknown>>[]>(() => []);
  const isMounted = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    isMounted.current = true;
    async function fetchData() {
      tableExampleData.loadData(false);
      const dataProvider = tableExampleData.dataProvider;
      providerAdapter.current = new TableDataProviderAdapter(dataProvider);
      const rowsCount = await providerAdapter.current.getRowsCount();

      await providerAdapter.current.adaptColumns();
      await providerAdapter.current.adaptRows(rowsCount);   // Adapt all for now - NEEDSWORK

      if (isMounted.current) {
        setFetchedColumns(
          [
            {
              Header: "Table",
              columns: providerAdapter.current.reactTableColumns,
            },
          ]
        );
        setFetchedData(providerAdapter.current.reactTableData); // Load all for now - NEEDSWORK
      }
    }

    setIsLoading(true);
    setTimeout(() => {
      fetchData(); // eslint-disable-line @typescript-eslint/no-floating-promises
      setIsLoading(false);
    });
  }, [tableExampleData]);

  // runs returned function only when component is unmounted.
  React.useEffect(() => {
    return (() => {
      isMounted.current = false;
    });
  }, []);

  const { isSortable, ...rest } = args;

  const onSelect = React.useCallback((_selectedData: Record<string, unknown>[] | undefined, _tableState?: TableState<Record<string, unknown>> | undefined) => {
  }, []);

  const onSort = React.useCallback((_state: TableState<Record<string, unknown>>) => {
  }, []);

  const onBottomReached = React.useCallback(async () => {
    if (providerAdapter.current) {
      const rowsCount = await providerAdapter.current.getRowsCount();
      if (providerAdapter.current.adaptedRowsCount < rowsCount) {
        setIsLoading(true);
        await providerAdapter.current.adaptRows(providerAdapter.current.adaptedRowsCount + 100);
        setFetchedData(providerAdapter.current.reactTableData);
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <Table
      style={{ height: "100%" }}
      density="extra-condensed"
      columns={fetchedColumns}
      data={fetchedData}
      emptyTableContent="No data."
      onBottomReached={onBottomReached}
      isLoading={isLoading}
      isSelectable={true}
      onSelect={onSelect}
      isSortable={isSortable}
      onSort={onSort}
      {...rest}
    />
  );
}

export class ReactTableDemoContentControl extends ContentControl {
  private _tableExampleData = new TableExampleData();

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <ReactTableDemo isSortable={true} />;
  }
}

