// SPIKE test: two processes, one write-on-demand briefcase file.
// Usage: node wod-test.js <worktree> [role] [file]
const path = require("path");
const { fork } = require("child_process");
const [, , worktree, role = "A", fileArg] = process.argv;
const be = require(path.join(worktree, "core/backend/lib/cjs/core-backend.js"));
const { IModelHost, StandaloneDb, BriefcaseDb, EditTxn } = be;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${role} +${Date.now() - t0}ms]`, ...a);
const prop = { namespace: "spike", name: "writer" };

function state(db) {
  return `readonly=${db.isReadonly} canBecomeWritable=${db.canBecomeWritable} value=${db.queryFilePropertyString(prop)}`;
}

function write(db, value) {
  const txn = new EditTxn(db, `write ${value}`);
  txn.start();
  txn.saveFileProperty(prop, value);
  return txn;
}

async function roleA() {
  const file = path.join(require("os").tmpdir(), `wod-${process.pid}.bim`);
  StandaloneDb.createEmpty(file, { rootSubject: { name: "wod" }, allowEdit: JSON.stringify({ txns: true }) }).close();

  const db = await BriefcaseDb.open({ fileName: file, writeOnDemand: true });
  log("opened:", state(db));

  // 1. First write switches to read-write.
  let txn = write(db, "A-1");
  log("after EditTxn.start:", state(db));
  txn.end();
  log("after end:", state(db));
  await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 300);
  log("after switch-back delay:", state(db));

  // 2. Start B. B opens read-only and watches.
  const b = fork(__filename, [worktree, "B", file], { stdio: "inherit" });
  await new Promise((r) => b.once("message", r)); // B opened

  // 3. A takes read-write and holds it (EditTxn open). B tries to write.
  txn = write(db, "A-2");
  log("A holds read-write, EditTxn open:", state(db));
  b.send("try-write");
  await new Promise((r) => b.once("message", r)); // B tried

  // 4. A saves and releases. B tries again.
  txn.end();
  await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 300);
  log("A after save + switch back:", state(db));
  b.send("try-write");
  await new Promise((r) => b.once("message", r));

  // 5. A sees B's change after B switches back.
  await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 500);
  log("A sees:", state(db));

  // 6. Undo in A: reverses B's txn (shared file).
  const status = db.txns.reverseSingleTxn();
  log("A undo status", status, state(db));

  b.send("quit");
  await new Promise((r) => b.once("exit", r));
  db.close();
}

async function roleB() {
  const db = await BriefcaseDb.open({ fileName: fileArg, writeOnDemand: true });
  log("opened:", state(db));
  process.send("opened");
  let attempt = 0;
  process.on("message", async (m) => {
    if (m === "quit") { db.close(); await IModelHost.shutdown(); process.exit(0); }
    attempt++;
    const start = Date.now();
    try {
      const txn = write(db, `B-${attempt}`);
      log(`write ${attempt} OK in ${Date.now() - start}ms:`, state(db));
      txn.end();
      await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 300);
      log(`after switch back:`, state(db));
    } catch (e) {
      let st; try { st = state(db); } catch (e2) { st = `STATE ERROR: ${e2.message}`; }
      log(`write ${attempt} FAILED in ${Date.now() - start}ms: ${e.message} (errorNumber ${e.errorNumber})`, st);
    }
    process.send("tried");
  });
}

(async () => {
  const cb = require(path.join(worktree, "core/bentley/lib/cjs/core-bentley.js")); cb.Logger.initializeToConsole(); cb.Logger.setLevelDefault(cb.LogLevel.Warning); cb.Logger.setLevel(be.BackendLoggerCategory.IModelDb, cb.LogLevel.Info);
  await IModelHost.startup({ cacheDir: path.join(require("os").tmpdir(), `wod-cache-${role}`) });
  if (role === "A") { await roleA(); await IModelHost.shutdown(); }
  else await roleB();
})().catch((e) => { console.error(role, e); process.exit(1); });
