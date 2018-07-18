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
import { createRandomECInstanceKey } from "@helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, Keys } from "@bentley/ecpresentation-common";
import {
  ECPresentation,
  SelectionHandler, SelectionManager, SelectionChangeEvent, SelectionChangeType, ISelectionProvider, SelectionChangeEventArgs,
} from "@bentley/ecpresentation-frontend";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/ECPresentationManager";
import { Table, TableProps, ColumnDescription, RowItem, TableDataChangeEvent } from "@bentley/ui-components";
import IUnifiedSelectionComponent from "@src/common/IUnifiedSelectionComponent";
import { ECPresentationTableDataProvider, withUnifiedSelection } from "@src/table";

// tslint:disable-next-line:variable-name naming-convention
const ECPresentationTable = withUnifiedSelection(Table);

describe("Table withUnifiedSelection", () => {

  let testRulesetId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<ECPresentationTableDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    testRulesetId = faker.random.word();
    selectionHandlerMock.reset();
    setupDataProvider();
  });

  const setupDataProvider = (providerMock?: moq.IMock<ECPresentationTableDataProvider>, imodel?: IModelConnection, rulesetId?: string, columns?: ColumnDescription[], rows?: RowItem[]) => {
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
    providerMock.setup((x) => x.getColumns()).returns(async () => columns!);
    providerMock.setup((x) => x.connection).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup((x) => x.getRowsCount()).returns(async () => rows!.length);
    providerMock.setup((x) => x.getRow(moq.It.isAnyNumber())).returns(async (i: number) => rows![i]);
    providerMock.setup((x) => x.onColumnsChanged).returns(() => new TableDataChangeEvent());
    providerMock.setup((x) => x.onRowsChanged).returns(() => new TableDataChangeEvent());
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
    mount(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
  });

  it("uses data provider's imodel and rulesetId", () => {
    const component = shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.imodel).to.equal(imodelMock.object);
    expect(component.rulesetId).to.equal(testRulesetId);
  });

  it("creates default implementation for selection handler when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    ECPresentation.selection = selectionManagerMock.object;

    const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
    presentationManagerMock
      .setup((x) => x.getContentDescriptor(moq.It.isAny(), moq.It.isAnyString(), moq.It.isAny(), moq.It.isAny()))
      .returns(async () => undefined);
    ECPresentation.presentation = presentationManagerMock.object;

    const component = shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.selectionHandler).to.not.be.undefined;
    expect(component.selectionHandler!.name).to.not.be.undefined;
    expect(component.selectionHandler!.rulesetId).to.eq(testRulesetId);
    expect(component.selectionHandler!.imodel).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      pageAmount={faker.random.number()}
    />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const table = shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
    table.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler when data provider changes", () => {
    const table = shallow<TableProps>(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();
    const dataProviderMock2 = moq.Mock.ofType<ECPresentationTableDataProvider>();
    setupDataProvider(dataProviderMock2, imodelMock2.object, rulesetId2);

    table.setProps({
      dataProvider: dataProviderMock2.object,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  it("handles missing selection handler when unmounts", () => {
    const component = shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.unmount();
  });

  it("handles missing selection handler when updates", () => {
    const component = shallow(<ECPresentationTable
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.instance().componentDidUpdate!(component.props(), component.state()!);
  });

  describe("selection handling", () => {

    describe("checking if row should be selected", () => {

      it("calls props callback and returns its result", () => {
        const row = createRandomRowItem();
        const result = faker.random.boolean();
        const spy = moq.Mock.ofType<(row: RowItem) => boolean>();
        spy.setup((x) => x(row)).returns(() => result).verifiable();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          isRowSelected={spy.object}
        />);

        const propCallback = table.find(Table).prop("isRowSelected") as ((row: RowItem) => boolean);
        const actualResult = propCallback(row);

        spy.verifyAll();
        expect(actualResult).to.eq(result);
      });

      it("returns false when there's no selection handler", () => {
        const row = createRandomRowItem();
        const selectionLevel = faker.random.number();
        selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet([row.key]));

        const component = shallow(<ECPresentationTable
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
        selectionHandlerMock.setup((x) => x.getSelection(selectionLevel)).returns(() => new KeySet([row.key]));

        const component = shallow(<ECPresentationTable
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

      it("calls props callback and aborts when it returns false", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(rows, true)).returns(() => false).verifiable();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsSelected={spy.object}
        />);

        table.find(Table).prop("onRowsSelected")!(rows, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("calls props callback and adds row keys to selection manager when callback returns true", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[], replace: boolean) => boolean>();
        spy.setup((x) => x(rows, false)).returns(() => true).verifiable();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsSelected={spy.object}
        />);

        table.find(Table).prop("onRowsSelected")!(rows, false);

        selectionHandlerMock.verify((x) => x.addToSelection(rows.map((r) => r.key), 1), moq.Times.once());
        selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("replaces keys in selection manager", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const selectionLevel = faker.random.number();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={selectionLevel}
        />);

        table.find(Table).prop("onRowsSelected")!(rows, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(rows.map((r) => r.key), selectionLevel), moq.Times.once());
      });

      it("does nothing if there's no selection handler", () => {
        const rows = [createRandomRowItem()];
        const selectionLevel = faker.random.number();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={selectionLevel}
        />, { disableLifecycleMethods: true });

        table.find(Table).prop("onRowsSelected")!(rows, true);

        selectionHandlerMock.verify((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        selectionHandlerMock.verify((x) => x.replaceSelection(rows.map((r) => r.key), selectionLevel), moq.Times.never());
      });

    });

    describe("deselecting rows", () => {

      it("calls props callback and removes row keys from selection manager when callback returns true", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[]) => boolean>();
        spy.setup((x) => x(rows)).returns(() => true).verifiable();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsDeselected={spy.object}
        />);

        table.find(Table).prop("onRowsDeselected")!(rows);

        selectionHandlerMock.verify((x) => x.removeFromSelection(rows.map((r) => r.key), 1), moq.Times.once());
        spy.verifyAll();
      });

      it("calls props callback and aborts when it returns false", () => {
        const rows = [createRandomRowItem(), createRandomRowItem()];
        const spy = moq.Mock.ofType<(nodes: RowItem[]) => boolean>();
        spy.setup((x) => x(rows)).returns(() => false).verifiable();

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          onRowsDeselected={spy.object}
        />);

        table.find(Table).prop("onRowsDeselected")!(rows);

        selectionHandlerMock.verify((x) => x.removeFromSelection(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
        spy.verifyAll();
      });

      it("does nothing when there's no selection handler", () => {
        const rows = [createRandomRowItem()];

        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
        />, { disableLifecycleMethods: true });

        table.find(Table).prop("onRowsDeselected")!(rows);

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
        shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to overall selection on selection changes when selection level of table and event is 0", () => {
        const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
        shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={0}
        />);
        triggerSelectionChange(keys, 0);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("sets data provider keys to an empty KeySet on selection changes with lower selection level when overall selection is empty", () => {
        const keys = new KeySet();
        shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        triggerSelectionChange(keys, 1);
        dataProviderMock.verify((x) => x.keys = keys, moq.Times.once());
      });

      it("ignores selection changes with selection level equal to table's boundary level when base ref is not initialized", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.dive().instance() as Table;
        const spy = spies.spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(spy).to.not.be.called;
      });

      it("ignores selection changes with selection level higher then table's boundary level", () => {
        // shallow rendering makes sure base ref doesn't get initialized
        const table = shallow(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.dive().instance() as Table;
        const spy = spies.spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 3);
        expect(spy).to.not.be.called;
      });

      it("calls updateSelectedRows on base Table on selection changes with selection level equal to table's boundary level", () => {
        const table = mount(<ECPresentationTable
          dataProvider={dataProviderMock.object}
          selectionHandler={selectionHandlerMock.object}
          selectionLevel={2}
        />);
        const base = table.find(Table).instance() as Table;
        const spy = spies.spy.on(base, Table.prototype.updateSelectedRows.name);
        triggerSelectionChange(new KeySet(), 2);
        expect(spy).to.be.called.once;
      });

    });

  });

});
