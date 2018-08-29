/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect, spy } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as moq from "@helpers/Mocks";
import { createRandomECInstanceKey } from "@helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, Keys, InstanceKey } from "@bentley/presentation-common";
import {
  Presentation,
  SelectionHandler, SelectionManager, SelectionChangeEvent, SelectionChangeType, ISelectionProvider, SelectionChangeEventArgs,
} from "@bentley/presentation-frontend";
import PresentationManager from "@bentley/presentation-frontend/lib/PresentationManager";
import { Table, TableProps, ColumnDescription, RowItem, TableDataChangeEvent } from "@bentley/ui-components";
import IUnifiedSelectionComponent from "@src/common/IUnifiedSelectionComponent";
import { PresentationTableDataProvider, withUnifiedSelection } from "@src/table";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTable = withUnifiedSelection(Table);

describe("Table withUnifiedSelection", () => {

  let testRulesetId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType(PresentationTableDataProvider);
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  before(() => {
    // https://github.com/Microsoft/TypeScript/issues/14151#issuecomment-280812617
    // tslint:disable-next-line:no-string-literal
    if (Symbol["asyncIterator"] === undefined) ((Symbol as any)["asyncIterator"]) = Symbol.for("asyncIterator");
  });
  beforeEach(() => {
    testRulesetId = faker.random.word();
    selectionHandlerMock.reset();
    selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
    selectionHandlerMock.setup((x) => x.getSelection(moq.It.isAnyNumber())).returns(() => new KeySet());
    setupDataProvider();
  });

  const setupDataProvider = (providerMock?: moq.IMock<PresentationTableDataProvider>, imodel?: IModelConnection, rulesetId?: string, columns?: ColumnDescription[], rows?: RowItem[]) => {
    if (!providerMock)
      providerMock = dataProviderMock;
    if (!imodel)
      imodel = imodelMock.object;
    if (!rulesetId)
      rulesetId = testRulesetId;
    if (!columns)
      columns = [];
    if (!rows)
      rows = [];
    providerMock.reset();
    providerMock.setup((x) => x.keys).returns(() => new KeySet());
    providerMock.setup((x) => x.getColumns()).returns(async () => columns!);
    providerMock.setup((x) => x.connection).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup((x) => x.getRowsCount()).returns(async () => rows!.length);
    providerMock.setup((x) => x.getRow(moq.It.isAnyNumber())).returns(async (i: number) => rows![i]);
    providerMock.setup((x) => x.onColumnsChanged).returns(() => new TableDataChangeEvent());
    providerMock.setup((x) => x.onRowsChanged).returns(() => new TableDataChangeEvent());
  };

  const createRandomRowItem = (): RowItem & { _key: InstanceKey } => {
    const k = createRandomECInstanceKey();
    return {
      _key: k,
      key: JSON.stringify(k),
      cells: [{
        key: faker.random.word(),
      }, {
        key: faker.random.word(),
      }],
    };
  };

  async function* createAsyncIterator<T>(list: T[]): AsyncIterableIterator<T> {
    for (const e of list)
      yield e;
  }

  it("mounts", () => {
    mount(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
  });

  it("uses data provider's imodel and rulesetId", () => {
    const component = shallow(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.imodel).to.equal(imodelMock.object);
    expect(component.rulesetId).to.equal(testRulesetId);
  });

  it("creates default implementation for selection handler when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAnyNumber())).returns(() => new KeySet());
    Presentation.selection = selectionManagerMock.object;

    const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
    presentationManagerMock
      .setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAnyString(), moq.It.isAny(), moq.It.isAny()))
      .returns(async () => undefined);
    Presentation.presentation = presentationManagerMock.object;

    const component = shallow(<PresentationTable
      dataProvider={dataProviderMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.selectionHandler).to.not.be.undefined;
    expect(component.selectionHandler!.name).to.not.be.undefined;
    expect(component.selectionHandler!.rulesetId).to.eq(testRulesetId);
    expect(component.selectionHandler!.imodel).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    const dpMock = moq.Mock.ofType<PresentationTableDataProvider>();
    setupDataProvider(dpMock);
    expect(shallow(<PresentationTable
      dataProvider={dpMock.object}
      selectionHandler={selectionHandlerMock.object}
      pageAmount={faker.random.number()}
    />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const table = shallow(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
    table.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler when data provider changes", () => {
    const table = shallow<TableProps>(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();
    const dataProviderMock2 = moq.Mock.ofType<PresentationTableDataProvider>();
    setupDataProvider(dataProviderMock2, imodelMock2.object, rulesetId2);

    table.setProps({
      dataProvider: dataProviderMock2.object,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  it("handles missing selection handler when unmounts", () => {
    const component = shallow(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.unmount();
  });

  it("handles missing selection handler when updates", () => {
    const component = shallow(<PresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.instance().componentDidUpdate!(component.props(), component.state()!);
  });

  describe("selection handling", () => {

    it("sets data provider keys to selection when mounts and highest selection level is lower than boundary", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [1]);
      selectionHandlerMock.setup((x) => x.getSelection(1)).returns(() => keysOverall);
      selectionHandlerMock.setup((x) => x.getSelection(2)).returns(() => new KeySet());
      shallow(<PresentationTable
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
        selectionLevel={3}
      />);
      dataProviderMock.verify((x) => x.keys = keysOverall, moq.Times.once());
    });

    it("sets data provider keys to selection when mounts and highest selection level is equal to boundary", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [1, 3]);
      selectionHandlerMock.setup((x) => x.getSelection(1)).returns(() => keysOverall);
      selectionHandlerMock.setup((x) => x.getSelection(2)).returns(() => new KeySet());
      selectionHandlerMock.setup((x) => x.getSelection(3)).returns(() => new KeySet([createRandomECInstanceKey()]));
      shallow(<PresentationTable
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
        selectionLevel={3}
      />);
      dataProviderMock.verify((x) => x.keys = keysOverall, moq.Times.once());
    });

    it("sets data provider keys to selection when mounts and data provider already has keys", () => {
      const keysOld = new KeySet([createRandomECInstanceKey()]);
      dataProviderMock.reset();
      dataProviderMock.setup((x) => x.keys).returns(() => keysOld);
      const keysNew = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [0]);
      selectionHandlerMock.setup((x) => x.getSelection(0)).returns(() => keysNew);
      shallow(<PresentationTable
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      dataProviderMock.verify((x) => x.keys = keysNew, moq.Times.once());
    });

    it("does nothing when mounts and data provider already has keys and there are no available selection levels", () => {
      const keysOld = new KeySet([createRandomECInstanceKey()]);
      dataProviderMock.reset();
      dataProviderMock.setup((x) => x.keys).returns(() => keysOld);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
      shallow(<PresentationTable
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      dataProviderMock.verify((x) => x.keys = moq.It.isAnyObject(KeySet), moq.Times.never());
    });

    describe("checking if row should be selected", () => {

      it("calls props callback and returns its result", () => {
        const row = createRandomRowItem();
        const result = faker.random.boolean();
        const callback = moq.Mock.ofType<(row: RowItem) => boolean>();
        callback.setup((x) => x(row)).returns(() => result).verifiable();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          isRowSelected={callback.object}
        />);

        const propCallback = table.find(Table).prop("isRowSelected") as ((row: RowItem) => boolean);
        const actualResult = propCallback(row);

        callback.verifyAll();
        expect(actualResult).to.eq(result);
      });

      it("returns false when there's no selection handler", () => {
        const row = createRandomRowItem();
        const selectionLevel = faker.random.number();
        selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet([row._key]));

        const component = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={selectionLevel}
        />, { disableLifecycleMethods: true });

        const propCallback = component.find(Table).prop("isRowSelected") as ((row: RowItem) => boolean);
        const result = propCallback(row);
        expect(result).to.be.false;
      });

      it("returns true when row key is in selection at the right level", () => {
        const row = createRandomRowItem();
        const selectionLevel = faker.random.number();
        selectionHandlerMock.reset();
        selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
        selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet([row._key]));

        const component = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={selectionLevel}
        />);

        const propCallback = component.find(Table).prop("isRowSelected") as ((row: RowItem) => boolean);
        const result = propCallback(row);
        expect(result).to.be.true;
      });

    });

    describe("selecting rows", () => {

      it("calls props callback and aborts when it returns false", async () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const callback = moq.Mock.ofType<(rowIterator: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>>();
        callback.setup((x) => x(rowsIter, true)).returns(async () => false).verifiable();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsSelected={callback.object}
        />);

        await table.find(Table).prop("onRowsSelected")!(rowsIter, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("calls props callback and adds row keys to selection manager when callback returns true", async () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const callback = moq.Mock.ofType<(rowIterator: AsyncIterableIterator<RowItem>, replace: boolean) => Promise<boolean>>();
        callback.setup((x) => x(rowsIter, false)).returns(async () => true).verifiable();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsSelected={callback.object}
        />);

        await table.find(Table).prop("onRowsSelected")!(rowsIter, false);

        selectionHandlerMock.verify((x) => x.addToSelection(rows.map((r) => r._key), 1), moq.Times.once());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("replaces keys in selection manager", async () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const selectionLevel = faker.random.number();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={selectionLevel}
        />);

        await table.find(Table).prop("onRowsSelected")!(rowsIter, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(rows.map((r) => r._key), selectionLevel), moq.Times.once());
      });

      it("does nothing if there's no selection handler", async () => {
        const rows = [createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const selectionLevel = faker.random.number();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionLevel={selectionLevel}
        />, { disableLifecycleMethods: true });

        await table.find(Table).prop("onRowsSelected")!(rowsIter, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(rows.map((r) => r._key), selectionLevel), moq.Times.never());
      });

    });

    describe("deselecting rows", () => {

      it("calls props callback and removes row keys from selection manager when callback returns true", async () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const callback = moq.Mock.ofType<(rowIterator: AsyncIterableIterator<RowItem>) => Promise<boolean>>();
        callback.setup((x) => x(rowsIter)).returns(async () => true).verifiable();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsDeselected={callback.object}
        />);

        await table.find(Table).prop("onRowsDeselected")!(rowsIter);

        selectionHandlerMock.verify((x) => x.removeFromSelection(rows.map((r) => r._key), 1), moq.Times.once());
        callback.verifyAll();
      });

      it("calls props callback and aborts when it returns false", async () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);
        const callback = moq.Mock.ofType<(rowIterator: AsyncIterableIterator<RowItem>) => Promise<boolean>>();
        callback.setup((x) => x(rowsIter)).returns(async () => false).verifiable();

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsDeselected={callback.object}
        />);

        await table.find(Table).prop("onRowsDeselected")!(rowsIter);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        callback.verifyAll();
      });

      it("does nothing when there's no selection handler", async () => {
        const rows = [createRandomRowItem()];
        const rowsIter = createAsyncIterator(rows);

        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
        />, { disableLifecycleMethods: true });

        await table.find(Table).prop("onRowsDeselected")!(rowsIter);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
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
        selectionHandlerMock.reset();
        selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [selectionLevel]);
        const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
        while (selectionLevel > 0) {
          selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, selectionLevel)).returns(() => new KeySet());
          selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet());
          selectionLevel--;
        }
        selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, 0)).returns(() => new KeySet(overallSelection));
        selectionHandlerMock.setup((x) => x.getSelection(0)).returns(() => new KeySet(overallSelection));
        selectionHandlerMock.target.onSelect!(args, selectionProviderMock.object);
      };

      it("sets data provider keys to overall selection on selection changes with lower selection level", () => {
        const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
        shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to overall selection on selection changes when selection level of table and event is 0", () => {
        const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
        shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={0}
        />);
        triggerSelectionChange(keys, 0);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to an empty KeySet on selection changes with lower selection level when overall selection is empty", () => {
        const keys = new KeySet();
        shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("ignores selection changes with selection level equal to table's boundary level when base ref is not initialized", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.dive().instance() as Table;
        const s = spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(s).to.not.be.called;
      });

      it("ignores selection changes with selection level higher then table's boundary level", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.dive().instance() as Table;
        const s = spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 3);
        expect(s).to.not.be.called;
      });

      it("calls updateSelectedRows on base Table on selection changes with selection level equal to table's boundary level", () => {
        const table = mount(<PresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.find(Table).instance() as Table;
        const s = spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(s).to.be.called.once;
      });

    });

  });

});
