/* ------------------------
 * This is an example of a Plugin that starts a webworker.
 * This particular example supports several different operations that the WebWorker can perform.
 * Each request returns a Promise that is fulfilled when the WebWorker responds.
 * Multiple requests can be made. They are processed serially in the order they are received.
 * A more sophisticated example could set up multiple WebWorkers and distribute the requests.
 * ------------------------ */

import { Plugin, PluginAdmin } from "@bentley/imodeljs-frontend";

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

class RequestMessage {
  constructor(public msgId: number, public operation: string, public operands: Array<any>) { }
}

// Subclass WorkerOperation for different request types.
// Instantiate the subclass and then call the sendMessage method.
abstract class WorkerOperation {
  public _resolve: resolveFunc | undefined = undefined;
  public _reject: rejectFunc | undefined = undefined;
  public msgId: number;

  constructor(private _worker: IMJsWorker, private _operation: string, private _operands: Array<any>) {
    this.msgId = _worker.nextMsgId;
  }

  // This is the executor method that is called immediately when you instantiate a Promise.
  // Here, we store the resolve and reject functions for use when we handle the message from the worker (see handleMessage).
  public executor(resolve: resolveFunc, reject: rejectFunc) {
    // save the resolve and reject functions to dispatch when we get reply back from the web worker.
    this._resolve = resolve;
    this._reject = reject;
    const message = new RequestMessage(this.msgId, this._operation, this._operands);

    // start the operation in the web worker.
    this._worker.webWorker.postMessage(message);
  }

  // This method puts together the request, sends it, and returns the Promise.
  public sendMessage(): Promise<any> {
    return new Promise(this.executor.bind(this));
  }

  // Called when the correct message is returned from the Web Worker.
  // This should be called only from the handleMessage method of IMJsWorker
  public doResolve(event: MessageEvent): void {
    // the return number is in event.data.result.
    this._resolve!(event.data["result"]);
  }

  // This should be called only from the handleMessage method of IMJsWorker.
  public doReject(errorEvent: ErrorEvent): void {
    this._reject!(new Error(`Error ${errorEvent.message} at file ${errorEvent.filename}, line number ${errorEvent.lineno} in worker`));
  }
}

// Operation that adds two numbers.
class AddOperation extends WorkerOperation {
  // store the operands.
  constructor(worker: IMJsWorker, operand1: number, operand2: number) {
    super(worker, "add", [operand1, operand2]);
  }
}

// Oeration that returns the factorial of a number
class FactorialOperation extends WorkerOperation {
  // store the operand
  constructor(worker: IMJsWorker, _operand: number) {
    super(worker, "factorial", [_operand]);
  }
}

class UrlToImageBitmapOperation extends WorkerOperation {
  constructor(worker: IMJsWorker, _url: string) {
    super(worker, "urlToImageBitmap", [_url]);
  }
}

/* ---------------- ifdef draco ----------------------
class DracoUrlDecodeOperation extends WorkerOperation {
  constructor(worker: IMJsWorker, _url: string) {
    super(worker, "dracoDecode", [_url]);
  }
}
 ----------------------------------------------- */

// Class that supervises the webWorker.
class IMJsWorker {
  public webWorker: Worker;
  private _queue: Map<number, WorkerOperation>;
  private _nextMsgId: number;

  public constructor(workerFile: string) {
    this.webWorker = new Worker(workerFile);
    this.webWorker.onmessage = this.handleMessage.bind(this);
    this.webWorker.onerror = this.handleError.bind(this);
    this._queue = new Map<number, WorkerOperation>();
    this._nextMsgId = 1;
  }

  // this is the method that gets responses from the webWorker.
  private handleMessage(event: MessageEvent) {
    const msgId: number = event.data["msgId"];
    const wo = this._queue.get(msgId);
    if (wo) {
      wo.doResolve(event);
      this._queue.delete(msgId)
    }
  }

  // this is the method that gets errors from the webworker.
  // We don't have any way of positively identifying which request caused the problem,
  // so we find the one with the lowest msgId, since that's the order we're processing them.
  private handleError(error: ErrorEvent) {
    let lowest = Number.MAX_SAFE_INTEGER;
    for (const msgId of this._queue.keys()) {
      lowest = Math.min(msgId, lowest);
    }
    const wo = this._queue.get(lowest);
    if (wo) {
      wo.doReject(error);
      this._queue.delete(lowest)
    }
  }

  private queueOperation(wo: WorkerOperation): Promise<any> {
    this._queue.set(wo.msgId, wo);
    return wo.sendMessage();
  }

  // returns the nextMsgId. Used only from the WorkerOperation class
  public get nextMsgId(): number {
    return this._nextMsgId++;
  }

  // queue the add operation
  public queueAddOperation(operand1: number, operand2: number): Promise<number> {
    const ao = new AddOperation(this, operand1, operand2);
    return this.queueOperation(ao);
  }

  // queue the factorial operation
  public queueFactorialOperation(operand: number): Promise<number> {
    const fo = new FactorialOperation(this, operand);
    return this.queueOperation(fo);
  }

  public queueUrlToBitmapOperation(url: string): Promise<ImageBitmap> {
    const uToBo = new UrlToImageBitmapOperation(this, url);
    return this.queueOperation(uToBo);
  }

/* ---------------- ifdef draco ----------------------
  public queueDracoUrlDecodeOperation(url: string): Promise<any> {
    const ddo = new DracoUrlDecodeOperation(this, url);
    return this.queueOperation(ddo);
  }
 * ----------------------------------------------- */
}

// The Plugin class that starts the web worker and sends it work each time it is invoked.
class StartWebWorker extends Plugin {
  private _testWorker: IMJsWorker | undefined;

  constructor(name: string, versionsRequired: string) {
    super(name, versionsRequired);
  }

  public async onExecute(_args: string[]) {
    // here we are sending tasks to the webworker.
    // make one request
    try {
      const result: number = await this._testWorker!.queueAddOperation(3, 4);
      console.log("add result is ", result);
    } catch (error) { console.log(error); }

    try {
      const imageBitmap: ImageBitmap = await this._testWorker!.queueUrlToBitmapOperation("galvanized03.jpg");
      console.log("image bitmap is", imageBitmap);
    } catch (error) { console.log(error); }

    /* ---------------- ifdef draco ----------------------
        try {
          const dracoResponse: any = await this._testWorker!.queueDracoUrlDecodeOperation("bunny.drc");
          console.log("draco response is", dracoResponse);
        } catch (error) { console.log(error); }
     ----------------------------------------------- */

    // make three requests. They are worked on serially by the webworker. A more sophisticated example could queue them up an use multiple workers.
    try {
      const results = await Promise.all([this._testWorker!.queueAddOperation(9, 10), this._testWorker!.queueAddOperation(7, 8), this._testWorker!.queueUrlToBitmapOperation("accudraw.png")]);
      let resultNum = 1;
      for (const result of results) {
        console.log("result number ", resultNum++, "is", result);
      }
    } catch (error) { console.log(error); }
  }

  public async onLoad(_args: string[]) {
    // This is where we start the webworker. The requests to it are made in the onExecute method.
    if (!(window as any).Worker)
      return;
    this._testWorker = new IMJsWorker("testWebWorker.js");
  }
}

// boilerplate plugin code that is executed when the module is loaded.
declare var IMODELJS_VERSIONS_REQUIRED: string;
declare var PLUGIN_NAME: string;
export const startWebWorker = new StartWebWorker(PLUGIN_NAME, IMODELJS_VERSIONS_REQUIRED);
PluginAdmin.register(startWebWorker);
