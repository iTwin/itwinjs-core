/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Column, TableState } from "react-table";
import { Table } from "@itwin/itwinui-react";
import { Centered, LoadingSpinner } from "@bentley/ui-core";
import { ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import { TableExampleData } from "../contentviews/TableExampleData";
import { TableDataProviderAdapter } from "./TableDataProviderAdapter";

export interface CellData {
  name: string;
  description: string;
}

export interface ReactTableDemoProps {
  isSortable?: boolean;
}

export function ReactTableDemo(args: ReactTableDemoProps) {
  const tableExampleData = React.useMemo(() => new TableExampleData(), []);
  const providerAdapter = React.useRef<TableDataProviderAdapter>();
  const [fetchedData, setFetchedData] = React.useState<Record<string, unknown>[]>(() => []);
  const [fetchedColumns, setFetchedColumns] = React.useState<Column<Record<string, unknown>>[]>(() => []);
  const isMounted = React.useRef(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(false);
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
        setFetchedData(providerAdapter.current.reactTableData);
        setFetchedColumns(
          [
            {
              Header: "Table",
              columns: providerAdapter.current.reactTableColumns,
            },
          ]
        );
      }
    }

    setIsInitialLoading(true);
    setTimeout(() => {
      fetchData(); // eslint-disable-line @typescript-eslint/no-floating-promises
      setIsInitialLoading(false);
    }, 100);
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

  if (isInitialLoading)
    return (
      <div style={{ height: "100%" }}>
        <Centered>
          <LoadingSpinner size="large" />
        </Centered>
      </div>
    );

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
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <ReactTableDemo isSortable={true} />;
  }
}

