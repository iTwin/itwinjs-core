/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Table } from "../../../src/table/component/Table";
import { TableDataProvider, TableDataChangeEvent } from "../../../src/table/TableDataProvider";
import * as moq from "typemoq";
import { shallow } from "enzyme";
import * as React from "react";

describe("Table", () => {
  /**
   * A scenario:
   * A person selects 4 elements which calls loadRows method. Loading a row takes time
   * so while it's loading a new selection might be made, which could be 2 elements.
   * If the first loadRows is still going, it will eventually try accessing 4th and 4th elements
   * but will get undefined. That is because new selection will change dataProvider to contain 2 elements instead of 4
   */
  it("did not throw when dataProvider was changed while updateRows was still going", async () => {
    // Set up handlers
    const rowChangeEvent = new TableDataChangeEvent();
    const columnChangeEvent = new TableDataChangeEvent();

    // Mock data provider
    const dataProviderMock = moq.Mock.ofType<TableDataProvider>(undefined, moq.MockBehavior.Strict);
    dataProviderMock.setup((provider) => provider.onRowsChanged).returns(() => rowChangeEvent);
    dataProviderMock.setup((provider) => provider.onColumnsChanged).returns(() => columnChangeEvent);
    dataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
    dataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 0);
    dataProviderMock.setup((a: any) => a.getRow(moq.It.isAnyNumber())).returns(async () => undefined);

    const table = shallow(<Table dataProvider={dataProviderMock.object} />);
    await (table.instance() as Table).update();

    let iteration = 0;
    dataProviderMock.reset();
    dataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
    dataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 1);
    dataProviderMock.setup((provider) => provider.getRow(moq.It.isAnyNumber())).callback(async () => {
      iteration++;
      if (iteration >= 2) {
        // Change data provider while update is still going
        dataProviderMock.reset();
        dataProviderMock.setup((provider) => provider.getColumns()).returns(async () => []);
        dataProviderMock.setup((provider) => provider.getRowsCount()).returns(async () => 0);
        dataProviderMock.setup((provider: any) => provider.getRow(moq.It.isAnyNumber())).returns(async () => undefined);
        await (table.instance() as Table).update();
      }
    }).returns(async () => ({ key: "", cells: [] }));

    await (table.instance() as Table).update();
  });
});
