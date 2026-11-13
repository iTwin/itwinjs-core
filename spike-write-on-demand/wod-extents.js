const path = require("path"); const os = require("os"); const { fork } = require("child_process");
const [, , wt, role = "A", fileArg] = process.argv;
const be = require(path.join(wt, "core/backend/lib/cjs/core-backend.js"));
const geom = require(path.join(wt, "core/geometry/lib/cjs/core-geometry.js"));
const { IModelHost, StandaloneDb, BriefcaseDb, EditTxn } = be;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ext = (db) => JSON.stringify(db.projectExtents.toJSON().high);
(async () => {
  await IModelHost.startup({ cacheDir: path.join(os.tmpdir(), `wod-ext-${role}`) });
  if (role === "A") {
    const file = path.join(os.tmpdir(), `wod-ext-${process.pid}.bim`);
    StandaloneDb.createEmpty(file, { rootSubject: { name: "wod" }, allowEdit: JSON.stringify({ txns: true }) }).close();
    const db = await BriefcaseDb.open({ fileName: file, writeOnDemand: true });
    let events = 0; db.onProjectExtentsChanged.addListener(() => events++);
    console.log("A extents before:", ext(db));
    const b = fork(__filename, [wt, "B", file], { stdio: "inherit" });
    await new Promise((r) => b.once("exit", r));
    await sleep(500);
    console.log("A extents after B:", ext(db), "onProjectExtentsChanged events:", events);
    // A writes something unrelated; extents must stay B's.
    const t = new EditTxn(db, "A"); t.start(); t.saveFileProperty({ namespace: "s", name: "x" }, "A"); t.end();
    console.log("A extents after own write:", ext(db));
    db.close();
  } else {
    const db = await BriefcaseDb.open({ fileName: fileArg, writeOnDemand: true });
    const t = new EditTxn(db, "B extents"); t.start();
    t.updateProjectExtents(new geom.Range3d(-5, -5, -5, 123, 456, 789)); t.end();
    console.log("B set extents:", ext(db));
    await sleep(BriefcaseDb.writeOnDemandSwitchBackDelay + 300);
    db.close();
  }
  await IModelHost.shutdown();
})().catch((e) => { console.error(role, e); process.exit(1); });
