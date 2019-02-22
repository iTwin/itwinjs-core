/* ---------------- ifdef draco ----------------------
 * import * as draco3d from "draco3d";
 * Notes on draco:
 * I have commented out the draco stuff. If you uncomment it and add a dependency on draco3d, it will work.
 * importing draco3d (as is commented off above) unfortunately webpacks in both the encoder and decoder,
 * adding 1.8 mbyte to the webpack. I tried several strategies for using only the encoder:
 * 1. Use importScripts rather than import so it isn't put in the webpack. I wanted to importScripts
 *    and then look at module.exports to get the CreateDracoModule function, but I couldn't figure out
 *    how to stop it from giving me referenceErrors on module.
 * 2. Try to import "draco3d/draco_decoder_nodejs" rather than draco. I couldn't get that to work either.
 *    It defined module.exports as a function rather than an object. Not sure whether that's the problem,
 *    but couldn't get it to work.
 * ----------------------------------------------- */
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

  /* ---------------- ifdef draco ----------------------
    public static async dracoDecode(url: string): Promise<object> {
      const response: Response = await fetch(url, { mode: "cors" });
      const rawBuffer: ArrayBuffer = await response.arrayBuffer();
      const decoderModule: any = draco3d.createDecoderModule({});
      const decoder: any = new decoderModule.Decoder();

      const dracoBuffer = new decoderModule.DecoderBuffer();
      dracoBuffer.Init(new Int8Array(rawBuffer), rawBuffer.byteLength);
      const geometryType = decoder.GetEncodedGeometryType(dracoBuffer);

      let dracoGeometry: any;
      if (geometryType === decoderModule.TRIANGULAR_MESH) {
        dracoGeometry = new decoderModule.Mesh();
        decoder.DecodeBufferToMesh(dracoBuffer, dracoGeometry);
      } else if (geometryType === decoderModule.POINT_CLOUD) {
        dracoGeometry = new decoderModule.PointCloud();
        decoder.DecodeBufferToPointCloud(dracoBuffer, dracoGeometry);
      } else {
        throw new Error("Draco Error: Unknown geometry type.");
      }
      // dispose of draco variables.
      decoderModule.destroy(dracoBuffer);
      decoderModule.destroy(decoder);

      // after copying the data back to the main thread, destroy it in the callback.
      return { result: dracoGeometry, transferable: false, callback: () => { decoderModule.destroy(dracoGeometry); } };
    }
   * ----------------------------------------------- */
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
      }
      else {
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
