/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as spies from "@helpers/Spies";
import * as moq from "@helpers/Mocks";
import { createRandomECInstanceKey } from "@helpers/random/EC";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, Keys } from "@bentley/ecpresentation-common";
import {
  ECPresentation, ECPresentationManager,
  SelectionHandler, SelectionManager, SelectionChangeEvent, SelectionChangeType, ISelectionProvider, SelectionChangeEventArgs,
} from "@bentley/ecpresentation-frontend";
import { ColumnDescription, RowItem, TableDataChangeEvent, Table as BaseTable } from "@bentley/ui-components";
import DataProvider from "@src/table/DataProvider";
import Table, { Props as TableProps } from "@src/table/Table";

describe("Table", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<DataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    selectionHandlerMock.reset();
    setupDataProvider();
  });

  const setupDataProvider = (columns?: ColumnDescription[], rows?: RowItem[]) => {
    dataProviderMock.reset();
    if (!columns)
      columns = [];
    if (!rows)
      rows = [];
    dataProviderMock.setup((x) => x.getColumns()).returns(async () => columns!);
    dataProviderMock.setup((x) => x.getRowsCount()).returns(async () => rows!.length);
    dataProviderMock.setup((x) => x.getRow(moq.It.isAnyNumber())).returns(async (i: number) => rows![i]);
    dataProviderMock.setup((x) => x.onColumnsChanged).returns(() => new TableDataChangeEvent());
    dataProviderMock.setup((x) => x.onRowsChanged).returns(() => new TableDataChangeEvent());
  };

  const createRandomRowItem = (): RowItem => {
    return {
      key: createRandomECInstanceKey(),
      cells: [{
        key: faker.random.word(),
        record: faker.random.words(),
      }, {
        key: faker.random.word(),
        record: faker.random.words(),
      }],
    };
  };

  it("mounts", () => {
    mount(<Table
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
  });

  it("creates default implementation for selection handler and data provider when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    ECPresentation.selection = selectionManagerMock.object;

    const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
    presentationManagerMock
      .setup((x) => x.getContentDescriptor(imodelMock.object, moq.It.isAnyString(), moq.It.isAny(), undefined, moq.It.isAny()))
      .returns(async () => undefined);
    ECPresentation.presentation = presentationManagerMock.object;

    const rulesetId = faker.random.word();

    const tree = mount(<Table
      imodel={imodelMock.object}
      rulesetId={rulesetId} />).instance() as Table;

    expect(tree.selectionHandler.name).to.not.be.undefined;
    expect(tree.selectionHandler.rulesetId).to.eq(rulesetId);
    expect(tree.selectionHandler.imodel).to.eq(imodelMock.object);

    expect(tree.dataProvider.rulesetId).to.eq(rulesetId);
    expect(tree.dataProvider.connection).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<Table
      id={faker.random.uuid()}
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()}
      pageSize={faker.random.number()}
    />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const table = mount(<Table
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
    table.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler and data provider when props change", () => {
    const table = mount<TableProps>(<Table
      dataProvider={dataProviderMock.object}
      selection={{ selectionHandler: selectionHandlerMock.object }}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();

    table.setProps({
      imodel: imodelMock2.object,
      rulesetId: rulesetId2,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());

    dataProviderMock.verify((x) => x.connection = imodelMock2.object, moq.Times.once());
    dataProviderMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  describe("selection handling", () => {

    describe("checking if row should be selected", () => {

      it("calls props callback and returns its result", () => {
        const row = createRandomRowItem();
        const result = faker.random.boolean();
        const spy = moq.Mock.ofType<(row: RowItem) => boolean>();
        spy.setup((x) => x(row)).returns(() => result).verifiable();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, isRowSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = table.find(BaseTable).prop("isRowSelected") as ((row: RowItem) => boolean);
        const actualResult = propCallback(row);

        spy.verifyAll();
        expect(actualResult).to.eq(result);
      });

      it("returns true when row key is in selection at the right level", () => {
        const row = createRandomRowItem();
        const selectionLevel = faker.random.number();
        selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet([row.key]));

        const tree = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: selectionLevel }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        const propCallback = tree.find(BaseTable).prop("isRowSelected") as ((row: RowItem) => boolean);
        const result = propCallback(row);
        expect(result).to.be.true;
      });

    });

    describe("selecting rows", () => {

      it("calls props callback and adds row keys to selection manager when callback returns true", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(rows, false)).returns(() => true).verifiable();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onRowsSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        table.find(BaseTable).prop("onRowsSelected")!(rows, false);

        selectionHandlerMock.verify((x) => x.addToSelection(rows.map((r) => r.key), 1), moq.Times.once());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(rows, true)).returns(() => false).verifiable();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onRowsSelected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        table.find(BaseTable).prop("onRowsSelected")!(rows, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("replaces keys in selection manager", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const selectionLevel = faker.random.number();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: selectionLevel }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        table.find(BaseTable).prop("onRowsSelected")!(rows, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(rows.map((r) => r.key), selectionLevel), moq.Times.once());
      });

    });

    describe("deselecting rows", () => {

      it("calls props callback and removes row keys from selection manager when callback returns true", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[]) => boolean>();
        spy.setup((x) => x(rows)).returns(() => true).verifiable();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onRowsDeselected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        table.find(BaseTable).prop("onRowsDeselected")!(rows);

        selectionHandlerMock.verify((x) => x.removeFromSelection(rows.map((r) => r.key), 1), moq.Times.once());
        spy.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[]) => boolean>();
        spy.setup((x) => x(rows)).returns(() => false).verifiable();

        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, onRowsDeselected: spy.object }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);

        table.find(BaseTable).prop("onRowsDeselected")!(rows);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

    });

    describe("reacting to unified selection changes", () => {

      const triggerSelectionChange = (overallSelection: Keys, selectionLevel: number) => {
        const args: SelectionChangeEventArgs = {
          changeType: SelectionChangeType.Clear,
          imodel: imodelMock.object,
          level: selectionLevel,
          source: selectionHandlerMock.name,
          timestamp: new Date(),
          keys: new KeySet(),
        };
        const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
        while (selectionLevel > 0) {
          selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, selectionLevel)).returns(() => new KeySet());
          selectionLevel--;
        }
        selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => new KeySet(overallSelection));
        selectionHandlerMock.target.onSelect!(args, selectionProviderMock.object);
      };

      it("sets data provider keys to overall selection on selection changes with lower selection level", () => {
        const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
        shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 2 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to overall selection on selection changes when selection level of table and event is 0", () => {
        const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
        shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 0 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        triggerSelectionChange(keys, 0);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to an empty KeySet on selection changes with lower selection level when overall selection is empty", () => {
        const keys = new KeySet();
        shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 2 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("ignores selection changes with selection level equal to table's boundary level when base ref is not initialized", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 2 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        const base = table.dive().instance() as BaseTable;
        const spy = spies.spy.on(base, BaseTable.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(spy).to.not.be.called;
      });

      it("ignores selection changes with selection level higher then table's boundary level", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 2 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        const base = table.dive().instance() as BaseTable;
        const spy = spies.spy.on(base, BaseTable.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 3);
        expect(spy).to.not.be.called;
      });

      it("calls updateSelectedRows on base Table on selection changes with selection level equal to table's boundary level", () => {
        const table = mount(<Table
          dataProvider={dataProviderMock.object}
          selection={{ selectionHandler: selectionHandlerMock.object, level: 2 }}
          imodel={imodelMock.object}
          rulesetId={faker.random.word()} />);
        const base = table.find(BaseTable).instance() as BaseTable;
        const spy = spies.spy.on(base, BaseTable.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(spy).to.be.called.once;
      });

    });

  });

});
