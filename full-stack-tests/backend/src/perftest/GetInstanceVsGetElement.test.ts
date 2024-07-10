import { IModelDb, IModelJsNative } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";

interface ElId {
  i: string;
  c: string;
}

function measureTime<T>(fn: () => T): [T, number] {
  const start = new Date().getTime();
  const result = fn();
  const end = new Date().getTime();
  return [result, end - start];
}

function getInstanceKeys(dgndb: IModelDb): ElId[] {
  const stmt = new iModelJsNative.SqliteStatement();
  const start = new Date().getTime();
  const ids: { i: string, c: string }[] = [];
  stmt.prepare(dgndb, "SELECT JSON_OBJECT('i', FORMAT('0x%x', Id), 'c', FORMAT('0x%x', ECClassId)) FROM bis_Element");
  while (DbResult.BE_SQLITE_ROW === stmt.step()) {
    ids.push(JSON.parse(stmt.getValueString(0)) as { i: string, c: string });
  }
  const end = new Date().getTime();
  process.stdout.write(`InstanceKeys: ${ids.length} - ${end - start} ms ${EOL}`);
  stmt.dispose();
  return ids;
}

function withDgnDb(testFileName: string, cb: (dgndb: IModelJsNative.DgnDb) => void) {
  const dgndb = openDgnDb(testFileName);
  assert.equal(DbResult.BE_SQLITE_OK, dgndb.executeSql(`PRAGMA MMAP_SIZE=${lstatSync(testFileName).size}`));
  cb(dgndb);
  dgndb.closeFile();
}

function executeGetElement(dgndb: IModelJsNative.DgnDb, ids: ElId[]) {
  const [, elapsed] = measureTime(() => {
    for (const key of ids) {
      assert.isDefined(dgndb.getElement({ id: key.i, wantGeometry: false }));
    }
  });
  process.stdout.write(`${ids.length} x getElement(${path.basename(dgndb.getFilePath())})  took ${elapsed} ms ${(ids.length / ((elapsed) / 1000)).toFixed(0)} elements/sec${EOL}`);
  return elapsed;
}

function executeGetInstance(dgndb: IModelJsNative.DgnDb, ids: ElId[]) {
  const [, elapsed] = measureTime(() => {
    for (const key of ids) {
      assert.isDefined(dgndb.getInstance(key.i, key.c, true, true));
      // assert.isDefined(dgndb.getInstance2(key.i, key.c));
    }
  });
  process.stdout.write(`${ids.length} x getInstance(${path.basename(dgndb.getFilePath())}) took ${elapsed} ms ${(ids.length / (elapsed / 1000)).toFixed(0)} elements/sec${EOL}`);
  return elapsed;
}

// function executeInstanceQuery(dgndb: IModelJsNative.DgnDb, ids:ElId[]) {
//   const ecsqlStmt = new iModelJsNative.ECSqlStatement();
//   ecsqlStmt.prepare(dgndb, "SELECT $ FROM BisCore.Element WHERE ECInstanceId=?");
//   const start = new Date().getTime();
//   let count = 0;
//   for (const key of ids) {
//     ecsqlStmt.reset();
//     ecsqlStmt.clearBindings();
//     ecsqlStmt.getBinder(1).bindId(key.i);
//     if (ecsqlStmt.step() === DbResult.BE_SQLITE_ROW) {
//       assert.isDefined(JSON.parse(ecsqlStmt.getValue(0).getString()));
//       ++count;
//     }
//   }
//   const end = new Date().getTime();
//   process.stdout.write(`${count} x SELECT $ (${path.basename(dgndb.getFilePath())}) took ${end - start} ms ${(count / ((end - start) / 1000)).toFixed(0)} elements/sec${EOL}`);
//   ecsqlStmt.dispose();
// }
describe.only("performance tests", function (this: Suite) {
  this.timeout(0);
  it("execute", () => {
    const testFileDir = "D:\\temp\\test-files\\";
    const files = [
      "BT4_Bergen-D12_CM.bim",
      "2ER04_EDP.bim",
      "03 North Portal Test.bim",
      "#662NS (Iron Bridge) (FMG Model) LARGE.bim",
      "Delaware River Waterfront Rail-DRWR04-S1.bim",
      "Test Tony Gee Jetty survey and PBP equal.bim",
      "Rebar - Test.bim",
      "DRWR04-S1.bim",
      "BSY-JR-Test.bim",
      "11 SLX.bim",
      "ALIGN-D - P3 - St Peter.bim",
    ];

    const sortedFiles = files.map((f) => {
      return {
        pathname: path.join(testFileDir, f),
        sz: fs.lstatSync(path.join(testFileDir, f)).size
      };
    }).sort((a, b) => a.sz - b.sz)

    const kRuns = 5;
    const output: any[] = [];
    sortedFiles.forEach((file) => {
      withDgnDb(file.pathname, (dgndb) => {
        const ids = getInstanceKeys(dgndb);
        for (let i = 0; i < kRuns; i++) {
          output.push({
            "run": i,
            "file": path.basename(dgndb.getFilePath()),
            "sz": `${(file.sz / (1024 * 1024)).toFixed(2)} MB`,
            "instance_count": ids.length,
            "get_instance": executeGetInstance(dgndb, ids),
            "get_element": executeGetElement(dgndb, ids),
          });
          fs.writeFileSync(path.join(testFileDir, "performance_2.json"), JSON.stringify(output, undefined, 2));
        }
      });
    });
  });
});
