import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { _nativeDb, GcsDbProps, GeoCoordConfig, getAvailableVerticalCoordinateReferenceSystems, IModelHost, IModelNative, SnapshotDb } from "@itwin/core-backend";
import { GeoCoordStatus, GeographicCRSProps, IModelProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

const enabled = ["1", "true", "yes"].includes(process.env.ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS?.trim().toLowerCase() ?? "");
const phase = process.env.ITWIN_VERTICAL_CRS_OFFLINE_PHASE;
const runProcess = promisify(execFile);

interface OfflineWorker {
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

interface OfflinePlatform {
  createWorker(nodeArgs: string[], env: NodeJS.ProcessEnv): OfflineWorker;
  verifyNetworkDenied(): Promise<void>;
}

async function verifyTcpDenied(host: string, port: number, expectedErrors: readonly string[]) {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(5000);
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("The offline worker unexpectedly connected to the network"));
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("The offline network isolation probe timed out"));
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code && expectedErrors.includes(error.code)) {
        process.stdout.write(`${phase}: network probe ${host}:${port} failed with ${error.code}\n`);
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

const linuxOfflinePlatform: OfflinePlatform = {
  createWorker(nodeArgs, env) {
    const workerEnv = { ...env };
    workerEnv.ITWIN_VERTICAL_CRS_OFFLINE_PARENT_NETNS = readlinkSync("/proc/self/ns/net");
    return {
      executable: "unshare",
      args: ["--user", "--map-root-user", "--net", "--", process.execPath, ...nodeArgs],
      env: workerEnv,
    };
  },
  async verifyNetworkDenied() {
    const parentNamespace = process.env.ITWIN_VERTICAL_CRS_OFFLINE_PARENT_NETNS;
    expect(parentNamespace, "parent network namespace is required").to.be.a("string").and.not.to.be.empty;
    const workerNamespace = readlinkSync("/proc/self/ns/net");
    expect(workerNamespace, "offline worker has a separate network namespace").not.to.equal(parentNamespace);
    const interfaces = JSON.parse((await runProcess("ip", ["-j", "link", "show"], { timeout: 5000 })).stdout) as Array<{ ifname: string, flags: string[] }>;
    expect(interfaces.map((entry) => entry.ifname)).to.deep.equal(["lo"]);
    expect(interfaces[0].flags).to.include("LOOPBACK").and.not.to.include("UP");
    for (const family of ["-4", "-6"]) {
      const routes = JSON.parse((await runProcess("ip", ["-j", family, "route", "show", "table", "all"], { timeout: 5000 })).stdout) as unknown[];
      expect(routes, `${family} offline routes`).to.be.empty;
      process.stdout.write(`${phase}: ${family} routes ${JSON.stringify(routes)}\n`);
    }
    process.stdout.write(`${phase}: parent namespace ${parentNamespace}, worker namespace ${workerNamespace}, interfaces ${JSON.stringify(interfaces)}\n`);
    await verifyTcpDenied("192.0.2.1", 443, ["ENETUNREACH", "EHOSTUNREACH"]);
  },
};

const macOSOfflinePlatform: OfflinePlatform = {
  createWorker(nodeArgs, env) {
    return {
      executable: "/usr/bin/sandbox-exec",
      args: ["-p", "(version 1)(allow default)(deny network*)", process.execPath, ...nodeArgs],
      env,
    };
  },
  async verifyNetworkDenied() {
    await verifyTcpDenied("127.0.0.1", 9, ["EPERM", "EACCES"]);
  },
};

const offlinePlatforms: Partial<Record<NodeJS.Platform, OfflinePlatform>> = {
  linux: linuxOfflinePlatform,
  darwin: macOSOfflinePlatform,
};
const runAcceptance = enabled && offlinePlatforms[process.platform] ? describe : describe.skip;

function getOfflinePlatform(): OfflinePlatform {
  const platform = offlinePlatforms[process.platform];
  if (!platform)
    throw new Error(`Offline network isolation is not implemented for ${process.platform}`);

  return platform;
}

async function verifyConversions(iModel: SnapshotDb) {
  const location = { x: 23.700523, y: 37.944210, z: 0 };
  const systems = getAvailableVerticalCoordinateReferenceSystems({ point: location });
  const egm96 = systems.find((entry) => entry.crsName === "EGM96 height");
  expect(egm96).not.to.be.undefined;
  expect(egm96!.id).to.equal("GEOID");
  expect(egm96!.epsg).to.equal(5773);
  expect(egm96!.unit).to.equal("Meter");
  const meterSystems = getAvailableVerticalCoordinateReferenceSystems({ unit: "mEtEr" });
  expect(meterSystems).not.to.be.empty;
  expect(meterSystems.every((entry) => entry.unit === "Meter")).to.be.true;

  const modelCrs: GeographicCRSProps = {
    horizontalCRS: { id: "LL84" },
    verticalCRS: { id: "GEOID", crsName: "EGM96 height" },
  };
  iModel[_nativeDb].updateIModelProps({ geographicCoordinateSystem: modelCrs } as IModelProps);
  const ellipsoid = JSON.stringify({ horizontalCRS: { id: "LL84" }, verticalCRS: { id: "ELLIPSOID" } });
  const forward = await iModel.getGeoCoordinatesFromIModelCoordinates({ target: ellipsoid, iModelCoords: [location] });
  expect(forward.geoCoords[0].s).to.equal(GeoCoordStatus.Success);
  const result = Point3d.fromJSON(forward.geoCoords[0].p);
  expect(result.x).to.be.closeTo(location.x, 0.000001);
  expect(result.y).to.be.closeTo(location.y, 0.000001);
  expect(result.z).to.be.closeTo(38.3, 0.5);

  const reverse = await iModel.getIModelCoordinatesFromGeoCoordinates({ source: ellipsoid, geoCoords: [result] });
  expect(reverse.iModelCoords[0].s).to.equal(GeoCoordStatus.Success);
  const roundtrip = Point3d.fromJSON(reverse.iModelCoords[0].p);
  expect(roundtrip.x).to.be.closeTo(location.x, 0.000001);
  expect(roundtrip.y).to.be.closeTo(location.y, 0.000001);
  expect(roundtrip.z).to.be.closeTo(location.z, 0.000001);
  process.stdout.write(`${phase}: EGM96 input ${JSON.stringify(location)}, ellipsoidal XYZ ${JSON.stringify(result)}, roundtrip XYZ ${JSON.stringify(roundtrip)}\n`);
}

runAcceptance("Vertical CRS production offline acceptance", function () {
  this.timeout(600_000);

  if (phase) {
    it(`runs the ${phase} worker`, async () => {
      const cacheDir = process.env.ITWIN_VERTICAL_CRS_OFFLINE_CACHE;
      expect(cacheDir).not.to.be.undefined;
      if (phase !== "prefetch")
        await getOfflinePlatform().verifyNetworkDenied();

      let iModel: SnapshotDb | undefined;
      await IModelHost.startup({ cacheDir });
      try {
        const addonPaths = Object.keys(require.cache).filter((fileName) => path.basename(fileName) === "imodeljs.node");
        expect(addonPaths, "exactly one native addon is loaded").to.have.lengthOf(1);
        const addonPath = realpathSync(addonPaths[0]);
        const nativeEntry = require.resolve("@bentley/imodeljs-native", { paths: [require.resolve("@itwin/core-backend")] });
        const nativePackage = JSON.parse(readFileSync(path.join(path.dirname(nativeEntry), "package.json"), "utf8")) as { version: string };
        const sha256 = createHash("sha256").update(readFileSync(addonPath)).digest("hex");
        process.stdout.write(`${phase}: ${process.platform}/${process.arch} ${process.version}, native package ${nativePackage.version}, addon ${addonPath}, SHA-256 ${sha256}\n`);
        IModelNative.platform.enableLocalGcsFiles(false);
        const defaults = IModelHost.appWorkspace.settings.getArray<GcsDbProps>(GeoCoordConfig.settingName.defaultDatabases)!;
        expect(defaults.map((entry) => entry.dbName)).to.deep.equal(["base", "allEarth"]);
        expect(defaults.every((entry) => entry.baseUri === "https://geocoord-workspace.itwinjs.org")).to.be.true;
        GeoCoordConfig.loadDefaultDatabases();

        if (phase === "cold-offline") {
          expect(() => getAvailableVerticalCoordinateReferenceSystems()).to.throw("unable to query vertical coordinate reference systems (status 16427)");
          process.stdout.write("cold-offline: networking denied and uncached dictionary unavailable\n");
          return;
        }

        for (const props of defaults) {
          const db = await IModelHost.appWorkspace.getWorkspaceDb(props);
          const container = db.container.cloudContainer!;
          if (phase === "prefetch") {
            const completed = await db.prefetch().promise;
            expect(completed, `${db.dbFileName} prefetch completed`).to.be.true;
          }
          const stats = container.queryDatabase(db.dbFileName)!;
          expect(stats.localBlocks, `${db.dbFileName} is fully cached`).to.equal(stats.totalBlocks);
          process.stdout.write(`${phase}: ${db.dbFileName} ${stats.localBlocks}/${stats.totalBlocks} blocks cached\n`);

          if (props.dbName === "base") {
            const blob = db.getBlob("VerticalDatumDefinitions.json");
            expect(blob).not.to.be.undefined;
            const dictionary = JSON.parse(new TextDecoder().decode(blob)) as { definitions: Array<{ verticalCRS: { crsName: string } }> };
            const expectedNames = dictionary.definitions.map((entry) => entry.verticalCRS.crsName).sort();
            expect(expectedNames).not.to.be.empty;
            expect(getAvailableVerticalCoordinateReferenceSystems().map((entry) => entry.crsName).sort()).to.deep.equal(expectedNames);
            process.stdout.write(`${phase}: ${expectedNames.length} dictionary definitions discovered\n`);
          }
        }
        if (phase === "prefetch")
          expect(await Promise.all(GeoCoordConfig.prefetches.map(async (task) => task.promise))).not.to.include(false);

        iModel = SnapshotDb.createEmpty(path.join(cacheDir!, `${phase}.bim`), { rootSubject: { name: "Vertical CRS production acceptance" } });
        await verifyConversions(iModel);
      } finally {
        iModel?.close();
        IModelNative.platform.enableLocalGcsFiles(true);
        await IModelHost.shutdown();
      }
    });
    return;
  }

  it("discovers and converts using stock production settings after prefetch with networking denied", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "itwin-vertical-crs-offline-"));
    try {
      for (const workerPhase of ["cold-offline", "prefetch", "offline"]) {
        const args = [require.resolve("mocha/bin/mocha.js"), __filename, "--no-config", "--timeout", "600000"];
        const env = { ...process.env };
        env.ITWIN_VERTICAL_CRS_OFFLINE_PHASE = workerPhase;
        env.ITWIN_VERTICAL_CRS_OFFLINE_CACHE = cacheDir;
        const worker: OfflineWorker = workerPhase === "prefetch"
          ? { executable: process.execPath, args, env }
          : getOfflinePlatform().createWorker(args, env);
        try {
          const result = await runProcess(worker.executable, worker.args, {
            env: worker.env,
            timeout: 600_000,
            maxBuffer: 4 * 1024 * 1024,
          });
          process.stdout.write(result.stdout);
          process.stderr.write(result.stderr);
        } catch (error) {
          const failure = error as Error & { stdout?: string, stderr?: string };
          process.stderr.write(`${workerPhase}: worker failed\n${failure.stdout ?? ""}${failure.stderr ?? ""}`);
          throw error;
        }
      }
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});