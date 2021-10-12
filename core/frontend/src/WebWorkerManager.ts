/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// This file contains the code that manages a pool of WebWorkers, starting and dispatching work to them.
// All the WebWorkers for a given instance of WebWorkerManager are the same, running the specified javascript
// code. The Web Worker javascript  must be set up to handle the set of WorkerOperation's that are sent by
// calls to queueOperation on WebWorkerManager.

// cSpell:words proxys

type ResolveFunc = ((arg: any) => void);
type RejectFunc = ((arg: Error) => void);

/** Class that manages Web Workers. The number of Web Worker threads can be specified.
 * Each Web Worker maintains a queue of requests, and queueOperation method selects
 * the thread with the fewest entries in the queue. Operations are represented as
 * subclasses of the abstract class WorkerOperation.
 * @alpha
 */
export class WebWorkerManager {
  private _workerProxys: WebWorkerProxy[];
  private _maxWebWorkers: number;
  private _workerJsFile: string;

  public constructor(workerJsFile: string, maxWebWorkers?: number) {
    this._workerJsFile = workerJsFile;
    this._maxWebWorkers = maxWebWorkers ? maxWebWorkers : 3;
    this._workerProxys = new Array<WebWorkerProxy>();
  }

  // queues an operation to one of the WebWorker threads. The workerJsFile must have a
  // handler method with the name of WorkerOperation.operation, and must return a result.
  public async queueOperation(operation: WorkerOperation): Promise<any> {
    const wwProxy: WebWorkerProxy = this.getBestQueue();
    return operation.sendMessage(wwProxy);
  }

  // selects the queue to which the request is directed.
  public getBestQueue(): WebWorkerProxy {
    let shortestExisting: number = Number.MAX_SAFE_INTEGER;
    let selectedProxy: WebWorkerProxy | undefined;
    let selectedLength: number = 0;
    if (this._workerProxys.length > 0) {
      for (const proxy of this._workerProxys) {
        if (proxy.queueLength < shortestExisting) {
          selectedProxy = proxy;
          selectedLength = proxy.queueLength;
          shortestExisting = selectedLength;
          if (selectedLength === 0)
            break;
        }
      }
    }

    // if we have no proxys yet, or if none of them have an empty queue, start a new WebWorker proxy.
    if (!selectedProxy || ((selectedLength > 0) && (this._workerProxys.length < this._maxWebWorkers))) {
      const length: number = this._workerProxys.push(new WebWorkerProxy(this._workerJsFile));
      selectedProxy = this._workerProxys[length - 1];
    }
    return selectedProxy;
  }
}

// the message sent to the webWorker.
class RequestMessage {
  constructor(public msgId: number, public operation: string, public operands: any) { }
}

/** Abstract base class for requests handled by a Web Worker.
 * @note - To direct a request to a Web Worker, create a subclass of WorkerOperation in the main thread,
 * instantiate that subclass, and then call the queueOperation method of the corresponding WebWorkerManager.
 * The javascript loaded by the WebWorkerManager must be configured to handle the request by implementing
 * a method equal to the operation argument of the WorkerOperation constructor.
 * @alpha
 */
export abstract class WorkerOperation {
  private _resolve: ResolveFunc | undefined = undefined;
  private _reject: RejectFunc | undefined = undefined;
  private _proxy: WebWorkerProxy | undefined = undefined;
  public msgId: number = 0;

  constructor(public operation: string, public operands: any[], public transferable?: any[]) {
  }

  // This is the executor method that is called immediately when you instantiate a Promise.
  // Here, we store the resolve and reject functions for use when we handle the message from the worker (see handleMessage).
  public executor(resolve: ResolveFunc, reject: RejectFunc) {
    // save the resolve and reject functions to dispatch when we get reply back from the web worker.
    this._resolve = resolve;
    this._reject = reject;

    // start the operation in the web worker.
    this._proxy!.enqueue(this);
  }

  // This method puts together the request, sends it, and returns the Promise.
  public async sendMessage(proxy: WebWorkerProxy): Promise<any> {
    this._proxy = proxy;
    return new Promise(this.executor.bind(this));
  }

  // Called when the correct message is returned from the Web Worker.
  // This should be called only from the handleMessage method of WebWorkerProxy
  public doResolve(event: MessageEvent): void {
    // the return value is in event.data.result.
    this._resolve!(event.data.result);
  }

  // This should be called only from the handleMessage method of WebWorkerProxy.
  public doReject(errorEvent: ErrorEvent): void {
    this._reject!(new Error(`Error ${errorEvent.message} at line number ${errorEvent.lineno} of file ${errorEvent.filename}, in the webworker thread`));
  }
}

class WebWorkerProxy {
  private _queue: Map<number, WorkerOperation>;
  private _worker: Worker;
  private _nextMsgId: number;

  public constructor(workerFile: string) {
    this._worker = new Worker(workerFile);
    this._worker.onmessage = this.handleMessage.bind(this);
    this._worker.onerror = this.handleError.bind(this);
    this._queue = new Map<number, WorkerOperation>();
    this._nextMsgId = 1;
  }

  // this is the method that gets responses (that worked) from the webWorker.
  private handleMessage(event: MessageEvent) {
    const msgId: number = event.data.msgId;
    const wo = this._queue.get(msgId);
    if (wo) {
      wo.doResolve(event);
      this._queue.delete(msgId);
    }
  }

  // this is the method that gets errors from the webworker.
  // Try to get the msgId out of the error we got back. That doesn't always work, because
  // sometimes we don't throw the error if it happens while the worker is loading. In that case
  // we find the message with the lowest msgId, since that's the order we're processing them.
  private handleError(error: ErrorEvent) {
    let errorMsgId = 0;
    let rejectError = error;
    if (error.hasOwnProperty("msgId") && error.hasOwnProperty("originalError")) {
      errorMsgId = (error as any).msgId;
      rejectError = (error as any).originalError;
    } else {
      // find the lowest number msgId.
      errorMsgId = Number.MAX_SAFE_INTEGER;
      for (const msgId of this._queue.keys()) {
        errorMsgId = Math.min(msgId, errorMsgId);
      }
    }
    // reject the promise and remove the message from the queue.
    const wo = this._queue.get(errorMsgId);
    if (wo) {
      wo.doReject(rejectError);
      this._queue.delete(errorMsgId);
    }
  }

  public enqueue(wo: WorkerOperation): void {
    wo.msgId = this._nextMsgId++;
    const message = new RequestMessage(wo.msgId, wo.operation, wo.operands);
    this._queue.set(wo.msgId, wo);
    this._worker.postMessage(message, wo.transferable ? wo.transferable : []);
  }

  // gets the queue size.
  public get queueLength(): number {
    return this._queue.size;
  }
}
