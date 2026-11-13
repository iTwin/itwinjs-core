const path = require("path"); const os = require("os");
const wt = process.argv[2];
const be = require(path.join(wt, "core/backend/lib/cjs/core-backend.js"));
const { IModelHost, StandaloneDb, BriefcaseDb, EditTxn } = be;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prop = { namespace: "spike", name: "writer" };
const st = (db) => `readonly=${db.isReadonly} value=${db.queryFilePropertyString(prop)} undoPossible=${db.txns.isUndoPossible} redoPossible=${db.txns.isRedoPossible}`;
(async () => {
  await IModelHost.startup({ cacheDir: path.join(os.tmpdir(), "wod-cache-U") });
  const file = path.join(os.tmpdir(), `wod-undo-${process.pid}.bim`);
  StandaloneDb.createEmpty(file, { rootSubject: { name: "wod" }, allowEdit: JSON.stringify({ txns: true }) }).close();
  const db = await BriefcaseDb.open({ fileName: file, writeOnDemand: true });
  for (const v of ["one", "two"]) { const t = new EditTxn(db, v); t.start(); t.saveFileProperty(prop, v); t.end(); }
  console.log("after 2 writes, still read-write:", st(db));
  console.log("undo while read-write:", db.txns.reverseSingleTxn(), st(db));
  console.log("redo:", db.txns.reinstateTxn(), st(db));
  await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 300);
  console.log("after switch back:", st(db));
  console.log("undo after switch back:", db.txns.reverseSingleTxn(), st(db));
  db.close(); await IModelHost.shutdown();
})().catch((e) => { console.error(e); process.exit(1); });
