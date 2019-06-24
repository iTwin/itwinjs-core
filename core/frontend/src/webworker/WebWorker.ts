/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* -----------------------------------------
This is an example of a web worker that can (after transpiling) be loaded by frontend/WebWorkerManager
and invoked to do specific compute-intensive task by calling WebWorkerManager.queueOperation.

Currently, this source is not used and not built.
That is because we discovered that there wasn't as much to be gained from using web workers
to decode jpeg tile as we had hoped there would be, and it added some complexity, as well as
requiring additional work in some browsers (it worked in Firefox and Chrome, did not in Edge).
To restore it, uncomment the use of it in in GltfTileIO.ts, and add the lines below to the
"submMdules" key to core/frontend/package.json

{
  "dest": "./lib/module",
  "entry": "./lib/webworker/WebWorker.js",
  "bundleName": "frontend-webworker",
  "type": "webworker"
}

------------------------------------------- */
// reply sent through PostMessage
class WorkerReply {
  constructor(public msgId: number, public result: any) { }
}

// error thrown when we detect or catch an error.
class WorkerError extends Error {
  constructor(public msgId: number, public originalError: Error) {
    super("Worker Error");
  }
}

class TestWebWorker {
  public static add(a: number, b: number): Promise<number> {
    return Promise.resolve(a + b);
  }

  // example of calculating factorial. Just for illustration, not actually used.
  public static factorial(a: number): Promise<number> {
    if (a <= 1)
      Promise.resolve(1);
    let result: number = 1;
    for (; a > 1; a--) {
      result = result * a;
    }
    return Promise.resolve(result);
  }

  // an example of loading a url and converting it to a ImageBitmap, not actually used.
  public static async urlToImageBitmap(url: string): Promise<object> {
    // first we have to fetch the file.
    const response: Response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    const imageBitMap = await createImageBitmap(blob);
    return { result: imageBitMap, transferable: true };
  }

  // the incoming message is a Uint8Array. We convert it to an HtmlImageElement and send that back.
  // This can be used from GltfTileIO.ts, but is currently commented out. See GltfTileIO.ts for more information.
  public static async imageBytesToImageBitmap(bytes: ArrayBuffer, mimeType: string) {
    const blob: Blob = new Blob([bytes], { type: mimeType });
    const imageBitMap = await createImageBitmap(blob);
    return { result: imageBitMap, transferable: true };
  }

  // message handling method (see the onmessage assignment at the end of the file).
  // The operation is sent in a RequestOperation from one of the WebWorkerProxy objects, routed here
  // based on the "operation" property on the event, and the result returned.
  public static messageHandler(event: MessageEvent) {
    if (!event.data.hasOwnProperty("msgId")) {
      throw new WorkerError(0, new Error("Improperly formatted message: msgId property needed"));
    }
    if (!event.data.hasOwnProperty("operation")) {
      throw new WorkerError(event.data.msgId, new Error("Improperly formatted message: operation property needed"));
    }
    if (!event.data.hasOwnProperty("operands")) {
      throw new WorkerError(event.data.msgId, new Error("Improperly formatted message: operands array property needed"));
    }
    const operation = event.data.operation;
    const operands = event.data.operands;
    const response = (TestWebWorker as any)[operation].apply(TestWebWorker, operands);
    response.then((result: any) => {
      // We got an object back from the operation.
      if (typeof result === "object") {
        const reply: WorkerReply = new WorkerReply(event.data.msgId, result.result);
        postMessage(reply, result.transferable ? [reply.result] : []);
        if (result.callback)
          result.callback();
      } else {
        const reply: WorkerReply = new WorkerReply(event.data.msgId, result);
        postMessage(reply);
      }
    }).catch((error: Error) => {
      // the setTimeout here came from a search of trying to send to the onerror: https://stackoverflow.com/questions/39992417/how-to-bubble-a-web-worker-error-in-a-promise-via-worker-onerror
      setTimeout(() => { throw new WorkerError(event.data.msgId, error); });
    });
  }
}

// set up the handler called whenever a message is sent to the web worker.
onmessage = TestWebWorker.messageHandler;
