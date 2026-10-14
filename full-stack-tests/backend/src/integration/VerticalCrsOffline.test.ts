import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
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
const loadModule = createRequire(__filename);

interface OfflineWorker {
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cleanup?: () => Promise<void>;
}

interface OfflinePlatform {
  createWorker(nodeArgs: string[], env: NodeJS.ProcessEnv): Promise<OfflineWorker>;
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
  async createWorker(nodeArgs, env) {
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
  async createWorker(nodeArgs, env) {
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

const windowsHelper = path.resolve(__dirname, "../../../src/integration/VerticalCrsOffline.windows.ps1");
const powershell = process.env.ITWIN_VERTICAL_CRS_OFFLINE_POWERSHELL ?? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
interface ProbeEndpoint { address: string; family: number }

async function windowsFirewall(action: string, ruleName?: string, executable?: string) {
  expect(path.isAbsolute(powershell), "PowerShell host path must be absolute").to.be.true;
  const args = ["-NoProfile", "-NonInteractive", "-File", windowsHelper, "-Action", action];
  if (ruleName && executable)
    args.push("-RuleName", ruleName, "-Executable", executable);

  const result = await runProcess(powershell, args, { timeout: 30_000 });
  const policy: unknown = JSON.parse(result.stdout);
  process.stdout.write(`${phase ?? "parent"}: firewall ${action} ${JSON.stringify(policy)}\n`);
}

async function probeTcp(endpoint: ProbeEndpoint, connect: typeof createConnection): Promise<string> {
  return new Promise((resolve) => {
    const socket = connect({ host: endpoint.address, family: endpoint.family, port: 443 });
    const finish = (result: string) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(5000);
    socket.once("connect", () => finish("connected"));
    socket.once("timeout", () => finish("timeout"));
    socket.once("error", (error: NodeJS.ErrnoException) => finish(error.code ?? "unknown"));
  });
}

async function probeExecutable(executable: string, endpoint: ProbeEndpoint) {
  const script = `(${probeTcp.toString()})(${JSON.stringify(endpoint)}, require('node:net').createConnection).then(result => process.stdout.write(JSON.stringify(result)))`;
  const result = await runProcess(executable, ["-e", script], { timeout: 10_000 });
  const status = JSON.parse(result.stdout) as string;
  process.stdout.write(`parent: ${executable} TCP ${endpoint.address}:443 ${status}\n`);
  return status;
}

const windowsOfflinePlatform: OfflinePlatform = {
  async createWorker(nodeArgs, env) {
    await windowsFirewall("Check");
    const ruleName = `itwin-vertical-crs-offline-${randomUUID()}`;
    const directory = path.join(realpathSync.native(tmpdir()), ruleName);
    const executable = path.join(directory, "node.exe");
    const endpoints: ProbeEndpoint[] = [];
    let ruleAttempted = false;
    const cleanup = async () => {
      await windowsFirewall("Stop", ruleName, executable);
      if (ruleAttempted) {
        await windowsFirewall("Remove", ruleName, executable);
        for (const endpoint of endpoints)
          expect(await probeExecutable(executable, endpoint), "restored dedicated executable connectivity").to.equal("connected");
      }
      rmSync(directory, { recursive: true, force: true });
      process.stdout.write(`parent: removed owned directory ${directory}\n`);
    };
    const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
    process.stdout.write(`parent: owned rule ${ruleName}, executable ${executable}\nRecovery (elevated PowerShell): & ${quote(powershell)} -NoProfile -File ${quote(windowsHelper)} -Action Stop -RuleName ${quote(ruleName)} -Executable ${quote(executable)}; if ($LASTEXITCODE -eq 0) { & ${quote(powershell)} -NoProfile -File ${quote(windowsHelper)} -Action Remove -RuleName ${quote(ruleName)} -Executable ${quote(executable)}; if ($LASTEXITCODE -eq 0) { Remove-Item -LiteralPath ${quote(directory)} -Recurse -Force } }\n`);
    try {
      mkdirSync(directory);
      copyFileSync(process.execPath, executable);
      const hash = (fileName: string) => createHash("sha256").update(readFileSync(fileName)).digest("hex");
      expect(hash(executable), "dedicated Node binary hash").to.equal(hash(process.execPath));
      expect((await runProcess(executable, ["--version"], { timeout: 5000 })).stdout.trim()).to.equal(process.version);
      const addresses = await lookup("geocoord-workspace.itwinjs.org", { all: true });
      for (const family of [4, 6]) {
        const candidates = addresses.filter((entry) => entry.family === family);
        for (const endpoint of candidates) {
          if (await probeExecutable(executable, endpoint) === "connected") {
            endpoints.push(endpoint);
            break;
          }
        }
        if (!endpoints.some((entry) => entry.family === family))
          process.stdout.write(`parent: no reachable production IPv${family} endpoint (${candidates.length} resolved addresses)\n`);
      }
      expect(endpoints, "at least one reachable external control endpoint is required").not.to.be.empty;
      ruleAttempted = true;
      await windowsFirewall("Create", ruleName, executable);
      for (const endpoint of endpoints) {
        expect(await probeTcp(endpoint, createConnection), "original parent Node retains online connectivity").to.equal("connected");
        process.stdout.write(`parent: original Node TCP ${endpoint.address}:443 connected with worker rule active\n`);
      }
      const workerEnv = { ...env };
      workerEnv.ITWIN_VERTICAL_CRS_OFFLINE_RULE = ruleName;
      workerEnv.ITWIN_VERTICAL_CRS_OFFLINE_EXECUTABLE = executable;
      workerEnv.ITWIN_VERTICAL_CRS_OFFLINE_ENDPOINTS = JSON.stringify(endpoints);
      return {
        executable, args: nodeArgs, env: workerEnv, cleanup,
      };
    } catch (error) {
      try {
        await cleanup();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Windows offline setup and cleanup failed");
      }
      throw error;
    }
  },
  async verifyNetworkDenied() {
    const ruleName = process.env.ITWIN_VERTICAL_CRS_OFFLINE_RULE;
    const executable = process.env.ITWIN_VERTICAL_CRS_OFFLINE_EXECUTABLE;
    expect(ruleName, "owned firewall identity is required").to.be.a("string").and.not.to.be.empty;
    expect(executable, "dedicated executable is required").to.be.a("string").and.not.to.be.empty;
    expect(realpathSync(process.execPath).toLowerCase()).to.equal(realpathSync(executable!).toLowerCase());
    await windowsFirewall("Verify", ruleName, executable);
    const endpoints = JSON.parse(process.env.ITWIN_VERTICAL_CRS_OFFLINE_ENDPOINTS ?? "[]") as ProbeEndpoint[];
    expect(endpoints, "positive control endpoints are required").not.to.be.empty;
    for (const endpoint of endpoints) {
      const status = await probeTcp(endpoint, createConnection);
      expect(status, "matched external connection is blocked").to.be.oneOf(["timeout", "ETIMEDOUT", "EACCES", "EPERM"]);
      process.stdout.write(`${phase}: dedicated Node TCP ${endpoint.address}:443 blocked (${status})\n`);
    }
  },
};

const offlinePlatforms: Partial<Record<NodeJS.Platform, OfflinePlatform>> = {
  linux: linuxOfflinePlatform,
  darwin: macOSOfflinePlatform,
  win32: windowsOfflinePlatform,
};
const runAcceptance = enabled && offlinePlatforms[process.platform] ? describe : describe.skip;

function getOfflinePlatform(): OfflinePlatform {
  const platform = offlinePlatforms[process.platform];
  if (!platform)
    throw new Error(`Offline network isolation is not implemented for ${process.platform}`);

  return platform;
}

async function executeWorker(worker: OfflineWorker): Promise<{ stdout: string, stderr: string }> {
  if (process.platform !== "win32")
    return runProcess(worker.executable, worker.args, { env: worker.env, timeout: 600_000, maxBuffer: 4 * 1024 * 1024 });

  return new Promise((resolve, reject) => {
    let timedOut = false;
    const child = execFile(worker.executable, worker.args, { env: worker.env, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      clearTimeout(timer);
      if (error || timedOut) {
        reject(Object.assign(error ?? new Error("Owned Windows worker timed out"), { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        void runProcess(path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"), ["/PID", `${child.pid}`, "/T", "/F"], { timeout: 15_000 })
          .catch((error) => reject(new Error(`Could not terminate owned Windows worker tree: ${String(error)}`)));
      }
    }, 600_000);
  });
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

      if (process.env.ITWIN_VERTICAL_CRS_OFFLINE_FAIL_PHASE === phase)
        throw new Error(`Intentionally induced ${phase} worker failure for cleanup validation`);

      const nativeEntry = require.resolve("@bentley/imodeljs-native", { paths: [require.resolve("@itwin/core-backend")] });
      const nativeLibrary = loadModule(nativeEntry).NativeLibrary as { load: () => typeof IModelNative.platform };
      const originalLoad = nativeLibrary.load;
      const localAddon = process.env.ITWIN_VERTICAL_CRS_OFFLINE_ADDON;
      let iModel: SnapshotDb | undefined;
      let started = false;
      try {
        if (localAddon) {
          expect(path.isAbsolute(localAddon), "local addon path must be absolute").to.be.true;
          const localPlatform = loadModule(localAddon) as typeof IModelNative.platform;
          nativeLibrary.load = () => localPlatform;
        }
        await IModelHost.startup({ cacheDir });
        started = true;
        const addonPaths = Object.keys(require.cache).filter((fileName) => path.basename(fileName) === "imodeljs.node");
        expect(addonPaths, "exactly one native addon is loaded").to.have.lengthOf(1);
        const addonPath = realpathSync(addonPaths[0]);
        if (localAddon)
          expect(addonPath.toLowerCase(), "requested local addon is loaded").to.equal(realpathSync(localAddon).toLowerCase());

        const nativePackage = JSON.parse(readFileSync(path.join(path.dirname(nativeEntry), "package.json"), "utf8")) as { version: string };
        const sha256 = createHash("sha256").update(readFileSync(addonPath)).digest("hex");
        process.stdout.write(`${phase}: ${localAddon ? "requested local build" : "installed addon"}, ${process.platform}/${process.arch} ${process.version}, native package ${nativePackage.version}, addon ${addonPath}, SHA-256 ${sha256}\n`);
        IModelNative.platform.enableLocalGcsFiles(false);
        expect(IModelHost.appWorkspace.getCloudCache().isDaemon, "workspace resource egress must remain in-process").to.be.false;
        process.stdout.write(`${phase}: workspace cache is daemonless\n`);
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
        try {
          if (started) {
            iModel?.close();
            IModelNative.platform.enableLocalGcsFiles(true);
            await IModelHost.shutdown();
          }
        } finally {
          nativeLibrary.load = originalLoad;
        }
      }
    });
    return;
  }

  it("discovers and converts using stock production settings after prefetch with networking denied", async function () {
    if (process.platform === "win32")
      this.timeout(3 * 600_000 + 180_000);

    const cacheDir = mkdtempSync(path.join(tmpdir(), "itwin-vertical-crs-offline-"));
    let cleanupFailed = false;
    try {
      for (const workerPhase of ["cold-offline", "prefetch", "offline"]) {
        const args = [require.resolve("mocha/bin/mocha.js"), __filename, "--no-config", "--timeout", "600000"];
        const env = { ...process.env };
        env.ITWIN_VERTICAL_CRS_OFFLINE_PHASE = workerPhase;
        env.ITWIN_VERTICAL_CRS_OFFLINE_CACHE = cacheDir;
        const worker: OfflineWorker = workerPhase === "prefetch"
          ? { executable: process.execPath, args, env }
          : await getOfflinePlatform().createWorker(args, env);
        let workerFailure: Error | undefined;
        let cleanupFailure: Error | undefined;
        try {
          const result = await executeWorker(worker);
          process.stdout.write(result.stdout);
          process.stderr.write(result.stderr);
        } catch (error) {
          workerFailure = error instanceof Error ? error : new Error(String(error));
          const failure = error as Error & { stdout?: string, stderr?: string };
          process.stderr.write(`${workerPhase}: worker failed\n${failure.stdout ?? ""}${failure.stderr ?? ""}`);
        } finally {
          try {
            await worker.cleanup?.();
          } catch (cleanupError) {
            cleanupFailed = true;
            cleanupFailure = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
            process.stderr.write(`${workerPhase}: cleanup failed: ${cleanupFailure.message}\n`);
          }
        }
        if (workerFailure && cleanupFailure)
          throw new AggregateError([workerFailure, cleanupFailure], `${workerPhase}: worker and cleanup failed`);

        if (cleanupFailure)
          throw cleanupFailure;

        if (workerFailure)
          throw workerFailure;
      }
    } finally {
      if (cleanupFailed) {
        process.stderr.write(`parent: retained cache after cleanup failure: ${cacheDir}\n`);
      } else {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    }
  });
});