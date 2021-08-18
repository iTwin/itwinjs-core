/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CellProps, Column } from "react-table";

// import { RowItem } from "@bentley/ui-components";
import { Table } from "@itwin/itwinui-react";

// import { TableExampleData } from "../contentviews/TableExampleData";
// import { TableDataProviderAdapter } from "./TableDataProviderAdapter";

export interface CellData {
  name: string;
  description: string;
}

export interface ReactTableDemoProps {
  columns: Column<Record<string, unknown>>[];
  data: Record<string, unknown>[];
}

export function ReactTableDemo(args: ReactTableDemoProps) {
  //   const tableExampleData = React.useMemo(() => new TableExampleData(), []);
  //   const providerAdapter = React.useRef<TableDataProviderAdapter>();
  //   const [fetchedData, setFetchedData] = React.useState<RowItem[]>();
  //   const [fetchedColumns, setFetchedColumns] = React.useState<Column<RowItem>[]>();
  //   const isMounted = React.useRef(false);

  //   React.useEffect(() => {
  //     isMounted.current = true;
  //     async function fetchData() {
  //       tableExampleData.loadData(false);
  //       const dataProvider = tableExampleData.dataProvider;
  //       providerAdapter.current = new TableDataProviderAdapter(dataProvider);
  //       await providerAdapter.current.adapt();
  //       if (isMounted.current) {
  //         setFetchedData(providerAdapter.current.reactTableData);
  //         setFetchedColumns(
  //           [
  //             {
  //               Header: "columns",
  //               columns: providerAdapter.current.reactTableColumns,
  //             },
  //           ]
  //         );
  //       }
  //     }
  //     fetchData(); // eslint-disable-line @typescript-eslint/no-floating-promises
  //   }, [tableExampleData, setFetchedData, setFetchedColumns]);

  //   // runs returned function only when component is unmounted.
  //   React.useEffect(() => {
  //     return (() => {
  //       isMounted.current = false;
  //     });
  //   }, []);

  //   // const [selectedRow, setSelectedRow] = React.useState<number | undefined>();

  //   const data = fetchedData ? fetchedData : [];
  //   const columns = fetchedColumns ? fetchedColumns : [];

  //   // const onRowClicked = (row: Row<RowItem>) => {
  //   //   const rowIndex = data.findIndex((value) => value === row.original);
  //   //   setSelectedRow(rowIndex);
  //   // };

  //   return (
  //     <div style={{ height: "100%" }}>
  //       <Table
  //         columns={columns}
  //         data={data}
  //         isNextPageLoading={false}
  //         hasNextPage={false}
  //         loadMoreItems={async () => null}
  //         // onRowClick={onRowClicked}
  //         reset={false}
  //       // selectedRow={selectedRow}
  //       />
  //     </div>
  //   );
  const { columns, data, ...rest } = args;
  const onClickHandler = (
    _props: CellProps<CellData>,
  ) => { }; // action(props.row.original.name)();
  const tableColumns = React.useMemo(
    () => [
      {
        Header: 'Table',
        columns: [
          {
            id: 'name',
            Header: 'Name',
            accessor: 'name',
          },
          {
            id: 'description',
            Header: 'Description',
            accessor: 'description',
            maxWidth: 200,
          },
          {
            id: 'click-me',
            Header: 'Click',
            width: 100,
            Cell: (props: CellProps<CellData>) => {
              const onClick = () => onClickHandler(props);
              return (
                <a className='iui-anchor' onClick={onClick}>
                  Click me!
                </a>
              );
            },
          },
        ],
      },
    ],
    [],
  );

  const tableData = React.useMemo(
    () => [
      { name: 'Name1', description: 'Description1' },
      { name: 'Name2', description: 'Description2' },
      { name: 'Name3', description: 'Description3' },
    ],
    [],
  );

  return (
    <Table
      columns={columns || tableColumns}
      data={data || tableData}
      emptyTableContent='No data.'
      {...rest}
    />
  );
}
