import { expect } from "chai";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { ClientRequest, createServer } from "node:http";
import { Agent, request } from "node:https";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { _nativeDb, GcsDbProps, GeoCoordConfig, getAvailableVerticalCoordinateReferenceSystems, IModelHost, IModelNative, SettingsPriority, SnapshotDb } from "@itwin/core-backend";
import { GeoCoordStatus, GeographicCRSProps, IModelProps } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";

const resourceEnabled = ["1", "true", "yes"].includes(process.env.ITWIN_INCLUDE_VERTICAL_CRS_RESOURCE_TESTS?.trim().toLowerCase() ?? "");
const offlineEnabled = ["1", "true", "yes"].includes(process.env.ITWIN_INCLUDE_VERTICAL_CRS_OFFLINE_TESTS?.trim().toLowerCase() ?? "");
const phase = process.env.ITWIN_VERTICAL_CRS_OFFLINE_PHASE;
const runProcess = promisify(execFile);
const loadModule = createRequire(__filename);

async function createWorkspaceEndpoint() {
  let requests = 0;
  const failures: string[] = [];
  const upstreams = new Set<ClientRequest>();
  const agent = new Agent({ keepAlive: true, maxSockets: 6 });
  const server = createServer((incoming, outgoing) => {
    if (!["GET", "HEAD"].includes(incoming.method ?? "") || !incoming.url?.startsWith("/gcs/")) {
      outgoing.writeHead(400).end();
      return;
    }

    requests++;
    const upstream = request({
      hostname: "geocoord-workspace.itwinjs.org",
      path: incoming.url,
      method: incoming.method,
      agent,
      headers: { ...incoming.headers, host: "geocoord-workspace.itwinjs.org", connection: "keep-alive" },
    }, (response) => {
      if (!response.statusCode || response.statusCode >= 400)
        failures.push(`${incoming.url}: HTTP ${response.statusCode}`);

      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.on("error", (error) => outgoing.destroy(error));
      response.pipe(outgoing);
    });
    upstreams.add(upstream);
    upstream.once("close", () => upstreams.delete(upstream));
    upstream.on("error", (error) => {
      failures.push(`${incoming.url}: ${error.message}`);
      outgoing.destroy(error);
    });
    upstream.setTimeout(30_000, () => upstream.destroy(new Error("Workspace upstream request timed out")));
    incoming.once("aborted", () => upstream.destroy());
    outgoing.once("close", () => {
      if (!outgoing.writableFinished)
        upstream.destroy();
    });
    upstream.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Workspace endpoint did not bind a TCP port");

  return {
    baseUri: `http://127.0.0.1:${address.port}`,
    get requests() { return requests; },
    failures,
    async stop() {
      agent.destroy();
      if (!server.listening)
        return;

      const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      server.closeAllConnections();
      for (const upstream of upstreams)
        upstream.destroy();
      await closed;
    },
  };
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

function registerAcceptance(this: Mocha.Suite, resourceTest: boolean) {
  this.timeout(600_000);

  if (phase || !resourceTest) {
    it(`runs the ${phase ?? "requested"} worker`, async () => {
      // Note: environment variables are populated by the test runner before this code executes.
      expect(phase, "ITWIN_VERTICAL_CRS_OFFLINE_PHASE must select an operation").to.be.oneOf(["prefetch", "offline", "cold-offline"]);
      const cacheDir = process.env.ITWIN_VERTICAL_CRS_OFFLINE_CACHE;
      expect(cacheDir, "ITWIN_VERTICAL_CRS_OFFLINE_CACHE is required").to.be.a("string").and.not.to.be.empty;
      expect(path.isAbsolute(cacheDir!), "cache path must be absolute").to.be.true;
      const endpoint = process.env.ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT;
      if (resourceTest) {
        expect(endpoint, "test-owned loopback endpoint is required").to.match(/^http:\/\/127\.0\.0\.1:\d+$/);
      }

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
        let defaults = IModelHost.appWorkspace.settings.getArray<GcsDbProps>(GeoCoordConfig.settingName.defaultDatabases)!;
        expect(defaults.map((entry) => entry.dbName)).to.deep.equal(["base", "allEarth"]);
        expect(defaults.every((entry) => entry.baseUri === "https://geocoord-workspace.itwinjs.org")).to.be.true;
        if (resourceTest) {
          defaults = defaults.map((entry) => ({ ...entry, baseUri: endpoint!, prefetch: false }));
          IModelHost.appWorkspace.settings.addDictionary(
            { name: "vertical-crs-resource-regression", priority: SettingsPriority.application },
            { [GeoCoordConfig.settingName.defaultDatabases]: defaults },
          );
        }
        GeoCoordConfig.loadDefaultDatabases();

        if (phase === "cold-offline") {
          expect(() => getAvailableVerticalCoordinateReferenceSystems()).to.throw("unable to query vertical coordinate reference systems (status 16427)");
          process.stdout.write("cold-offline: resource endpoint unavailable and uncached dictionary unavailable\n");
          return;
        }

        if (phase === "prefetch")
          expect(await Promise.all(GeoCoordConfig.prefetches.map(async (task) => task.promise))).not.to.include(false);

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

  if (resourceTest) {
    it("converts from a persistent cache after its resource endpoint stops, but fails with an empty cache", async function () {
      this.timeout(3 * 600_000 + 30_000);
      const cacheRoot = mkdtempSync(path.join(tmpdir(), "itwin-vertical-crs-resource-"));
      let endpoint: Awaited<ReturnType<typeof createWorkspaceEndpoint>> | undefined;
      let workerOutput = "";
      try {
        endpoint = await createWorkspaceEndpoint();
        for (const workerPhase of ["prefetch", "offline", "cold-offline"]) {
          const env = { ...process.env };
          env.ITWIN_VERTICAL_CRS_OFFLINE_PHASE = workerPhase;
          env.ITWIN_VERTICAL_CRS_OFFLINE_CACHE = path.join(cacheRoot, workerPhase === "cold-offline" ? "empty" : "populated");
          env.ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT = endpoint.baseUri;
          const reportPath = path.join(cacheRoot, `${workerPhase}-results.json`);
          const args = [require.resolve("mocha/bin/mocha.js"), __filename, "--no-config", "--timeout", "600000", "--reporter", "json", "--reporter-option", `output=${reportPath}`];
          try {
            const result = await runProcess(process.execPath, args, { env, timeout: 600_000, maxBuffer: 4 * 1024 * 1024 });
            workerOutput += result.stdout + result.stderr;
          } catch (error) {
            const failure = error as Error & { stdout?: string, stderr?: string };
            process.stderr.write(`${workerPhase}: worker failed\n${workerOutput}${failure.stdout ?? ""}${failure.stderr ?? ""}`);
            if (existsSync(reportPath))
              process.stderr.write(`${readFileSync(reportPath, "utf8")}\n`);
            process.stderr.write(`parent: ${endpoint.requests} forwarded requests, failures ${JSON.stringify(endpoint.failures)}\n`);
            throw error;
          }
          if (workerPhase === "prefetch") {
            expect(endpoint.requests, "native prefetch used the test endpoint").to.be.greaterThan(0);
            await endpoint.stop();
            workerOutput += `parent: stopped ${endpoint.baseUri} after ${endpoint.requests} requests\n`;
          }
        }
      } finally {
        try {
          await endpoint?.stop();
        } finally {
          rmSync(cacheRoot, { recursive: true, force: true });
        }
      }
    });
  }
}

// Register in the parent process, or in a worker given the test-owned resource endpoint.
if (!phase || process.env.ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT !== undefined) {
  const runResourceRegression = resourceEnabled ? describe : describe.skip;
  runResourceRegression("Vertical CRS resource-unavailability regression", function () {
    registerAcceptance.call(this, true);
  });
}

// Register in the parent process, or in a production worker with no resource endpoint override.
if (!phase || process.env.ITWIN_VERTICAL_CRS_RESOURCE_ENDPOINT === undefined) {
  const runOffline = offlineEnabled ? describe : describe.skip;
  runOffline("Vertical CRS production offline acceptance", function () {
    registerAcceptance.call(this, false);
  });
}
