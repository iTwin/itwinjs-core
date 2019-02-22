// reply sent through PostMessage
class WorkerReply {
  constructor(public msgId: number, public result: any) { }
}

// error thrown when we detect or catch an error.
class WorkerError extends Error {
  constructor(public msgId: number, public originalError: Error) {
    super ("Worker Error");
  }
}

class TestWebWorker {
  public static add(a: number, b: number): Promise<number> {
    return Promise.resolve(a + b);
  }

  public static factorial(a: number): Promise<number> {
    if (a <= 1)
      Promise.resolve(1);
    let result: number = 1;
    for (; a > 1; a--) {
      result = result * a;
    }
    return Promise.resolve(result);
  }

  public static async urlToImageBitmap(url: string): Promise<object> {
    // first we have to fetch the file.
    const response: Response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    const imageBitMap = await createImageBitmap(blob);
    return { result: imageBitMap, transferable: true };
  }

  public static messageHandler(event: MessageEvent) {
    if (!event.data.hasOwnProperty("msgId")) {
      throw new WorkerError (0, new Error("Improperly formatted message: msgId property needed"));
    }
    if (!event.data.hasOwnProperty("operation")) {
      throw new WorkerError (event.data.msgId, new Error("Improperly formatted message: operation property needed"));
    }
    if (!event.data.hasOwnProperty("operands")) {
      throw new WorkerError (event.data.msgId, new Error("Improperly formatted message: operands array property needed"));
    }
    const operation = event.data.operation;
    const operands = event.data.operands;
    const response = (TestWebWorker as any)[operation].apply(TestWebWorker, operands);
    response.then((result: any) => {
      // We got an object back from the operation.
      if (typeof result === "object") {
        const reply: WorkerReply = new WorkerReply(event.data.msgId, result.result);
        postMessage(reply, result.transferable ? [reply.result] : undefined);
        if (result.callback)
          result.callback();
      } else {
        const reply: WorkerReply = new WorkerReply(event.data.msgId, result);
        postMessage(reply);
      }
    }).catch((error: Error) => {
      // the setTimeout here came from a search of trying to send to the onerror: https://stackoverflow.com/questions/39992417/how-to-bubble-a-web-worker-error-in-a-promise-via-worker-onerror
      setTimeout(() => { throw new WorkerError (event.data.msgId, error); });
    });
  }
}

onmessage = TestWebWorker.messageHandler;
