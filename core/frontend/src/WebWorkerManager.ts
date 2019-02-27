/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// This file contains the code that manages a pool of WebWorkers, starting and dispatching work to them.
// All the WebWorkers are the same, running the core/frontend/WebWorker code and capable of handling
// any of the requests that this manager

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

/** Class that manages WebWorkers
 * @alpha
 */
export class WebWorkerManager {
  private _workerProxys: WebWorkerProxy[];
  private _maxWebWorkers: number;
  private _workerJsFile: string;

  private constructor(workerJsFile: string, maxWebWorkers?: number) {
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
  constructor(public msgId: number, public operation: string, public operand: any) { }
}

// Subclass WorkerOperation for different request types.
// Instantiate the subclass and then call the sendMessage method.
abstract class WorkerOperation {
  private _resolve: resolveFunc | undefined = undefined;
  private _reject: rejectFunc | undefined = undefined;
  private _proxy: WebWorkerProxy | undefined = undefined;
  public msgId: number = 0;

  constructor(private _operation: string, private _operand: any, private _transferable: [] | undefined) {
  }

  // This is the executor method that is called immediately when you instantiate a Promise.
  // Here, we store the resolve and reject functions for use when we handle the message from the worker (see handleMessage).
  public executor(resolve: resolveFunc, reject: rejectFunc) {
    // save the resolve and reject functions to dispatch when we get reply back from the web worker.
    this._resolve = resolve;
    this._reject = reject;
    const message = new RequestMessage(this.msgId, this._operation, this._operand);

    // start the operation in the web worker.
    this._proxy!.webWorker.postMessage(message, this._transferable);
  }

  // This method puts together the request, sends it, and returns the Promise.
  public async sendMessage(proxy: WebWorkerProxy): Promise<any> {
    this.msgId = proxy.nextMsgId;
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
    this.webWorker.onmessage = this.handleMessage.bind(this);
    this.webWorker.onerror = this.handleError.bind(this);
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

  // gets the queue size.
  public get queueLength(): number {
    return this._queue.size;
  }

  // returns the nextMsgId. Used only from the WorkerOperation class
  public get nextMsgId(): number {
    return this._nextMsgId++;
  }

  public get webWorker(): Worker {
    return this._worker;
  }
}
