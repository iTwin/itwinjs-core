import { strictEqual } from "node:assert";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setImmediate } from "node:timers/promises";
import * as WebSocket from "ws";
import { RpcInterface, RpcManager } from "@itwin/core-common";
import { MobileHost } from "../../backend/MobileHost";
import { MobileRpcServer } from "../../backend/MobileRpcServer";
import { MobileRpcManager } from "../../common/MobileRpcManager";
import { MobileRpcProtocol } from "../../common/MobileRpcProtocol";

const sampleIntervalMs = 10;
const memoryFields = ["rss", "heapUsed", "external", "arrayBuffers"] as const;
type Memory = Pick<NodeJS.MemoryUsage, typeof memoryFields[number]>;

interface Measurements {
  baseline: Memory;
  peak: Memory;
  afterGc: Memory;
  lifetimeMaxRssBytes: number;
  samples: number;
}

export interface MemoryReport {
  payloadBytes: number;
  elapsedMs: number;
  sampleIntervalMs: number;
  frontend: Measurements;
  backend: Measurements;
}

function readMemory(): Memory {
  const { rss, heapUsed, external, arrayBuffers } = process.memoryUsage();
  return { rss, heapUsed, external, arrayBuffers };
}

class MemorySampler {
  private readonly _baseline = readMemory();
  private readonly _peak: Memory = { ...this._baseline };
  private _samples = 0;
  private readonly _timer = setInterval(() => this.sample(), sampleIntervalMs);

  public sample() {
    const memory = readMemory();
    for (const field of memoryFields)
      this._peak[field] = Math.max(this._peak[field], memory[field]);
    ++this._samples;
  }

  public stop(): Measurements {
    this.sample();
    clearInterval(this._timer);
    global.gc?.();
    return {
      baseline: this._baseline, peak: this._peak, afterGc: readMemory(),
      lifetimeMaxRssBytes: process.resourceUsage().maxRSS * 1024, samples: this._samples,
    };
  }
}

class MemoryRpc extends RpcInterface {
  public static readonly interfaceName = "MobileMemoryTestRpc";
  public static readonly interfaceVersion = "1.0.0";
  public async download(_bytes: number): Promise<Uint8Array> { return this.forward(arguments); }
}

let backendSampler: MemorySampler | undefined;

class MemoryRpcImpl extends MemoryRpc {
  public override async download(bytes: number): Promise<Uint8Array> {
    const data = new Uint8Array(bytes).fill(0x5a);
    backendSampler?.sample();
    return data;
  }
}

class HostWebSocket extends WebSocket {
  public constructor(address: string, protocols?: string | string[]) {
    super(address, protocols, { maxPayload: 0 });
  }
}

async function serve() {
  MobileHost.reconnect = () => undefined;
  const server = new MobileRpcServer();
  MobileRpcProtocol.obtainInterop = () => MobileRpcServer.interop;
  MobileRpcManager.initializeImpl([MemoryRpc]);
  RpcManager.registerImpl(MemoryRpc, MemoryRpcImpl);
  process.on("message", (command) => {
    if (command === "start") {
      global.gc?.();
      backendSampler = new MemorySampler();
      process.send?.("started");
    } else if (command === "stop") {
      process.send?.(backendSampler?.stop());
      backendSampler = undefined;
    }
  });
  process.once("disconnect", () => {
    backendSampler?.stop();
    server[Symbol.dispose]();
  });
  while (!MobileRpcServer.interop.port)
    await setImmediate();
  process.send?.({ port: MobileRpcServer.interop.port, token: MobileRpcServer.rpcToken });
}

async function receive(client: MemoryRpc, bytes: number, sampler?: MemorySampler): Promise<void> {
  const data = await client.download(bytes);
  sampler?.sample();
  strictEqual(data.byteLength, bytes);
  strictEqual(data[0], 0x5a);
  strictEqual(data[Math.floor(bytes / 2)], 0x5a);
  strictEqual(data[bytes - 1], 0x5a);
}

async function measure(payloadBytes: number): Promise<MemoryReport> {
  const backend = fork(__filename, ["backend"], { execArgv: ["--expose-gc"], silent: true });
  const exited = once(backend, "exit");
  let diagnostics = "";
  backend.stderr?.on("data", (data: Buffer) => { diagnostics += data.toString(); });
  async function nextMessage() {
    return Promise.race([
      once(backend, "message"),
      exited.then(([code, signal]) => { throw new Error(`Backend exited before responding (code=${code}, signal=${signal}).`); }),
    ]);
  }
  let socket: globalThis.WebSocket | undefined;
  try {
    const [ready] = await nextMessage() as [{ port: number, token: string }];
    Object.defineProperty(globalThis, "window", {
      value: { location: { hash: `#port=${ready.port}&rpcToken=${ready.token}` }, setInterval, clearInterval },
    });
    Object.defineProperty(globalThis, "WebSocket", { value: HostWebSocket, configurable: true });
    const protocol = MobileRpcManager.initializeClient([MemoryRpc]).protocol;
    const frontendSocket = protocol.socket;
    socket = frontendSocket;
    await new Promise<void>((resolve, reject) => {
      frontendSocket.addEventListener("open", () => resolve(), { once: true });
      frontendSocket.addEventListener("error", () => reject(new Error("Mobile RPC connection failed.")), { once: true });
    });
    const client = RpcManager.getClientForInterface(MemoryRpc);
    await receive(client, 1024);
    let response = nextMessage();
    backend.send("start");
    await response;
    global.gc?.();
    const sampler = new MemorySampler();
    const started = performance.now();
    await receive(client, payloadBytes, sampler);
    const elapsedMs = performance.now() - started;
    const frontend = sampler.stop();
    response = nextMessage();
    backend.send("stop");
    const [measurements] = await response as [Measurements];
    return { payloadBytes, elapsedMs, sampleIntervalMs, frontend, backend: measurements };
  } catch (error) {
    throw new Error(`Mobile RPC memory measurement failed: ${String(error)}\n${diagnostics}`);
  } finally {
    socket?.close();
    backend.kill();
    await exited;
  }
}

if (require.main === module) {
  const task = process.argv[2] === "backend" ? serve() : measure(Number(process.argv[2])).then((report) => {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  });
  task.catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
