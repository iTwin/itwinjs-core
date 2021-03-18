/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

/** This contains the JavaScript code to manage a web worker for Basis transcoding.
 * This is Bentley-created code that uses the Binomial transcoder.
 * @internal
 **/
export const basisWorkerScript = `
var _basisModule;
var _initPromise;

addEventListener('message', function(e) {
  var message = e.data;
  switch(message.command) {
    case 'initializeBasisModule':
      initializeBasisModule(message.wasmBinary);
      break;
    case 'transcodeBasisImage':
      _initPromise.then( () => {
        var transcodeResult = transcodeBasisImage(message.basisBuffers[0], message.transcodeFormats);
        if (undefined === transcodeResult)
          self.postMessage({ type: 'transcodeBasisResult', result: 'failure' });
        else {
          self.postMessage({ type: 'transcodeBasisResult', result: 'success', dimensions: transcodeResult.dimensions, hasAlpha: transcodeResult.hasAlpha, transcodedBuffers: transcodeResult.buffers }, transcodeResult.buffers);
        }
      });
  }
}, false);

function initializeBasisModule(wasmBinary) {
  _initPromise = new Promise((resolve) => {
    _basisModule = { wasmBinary, onRuntimeInitialized: resolve };
    BASIS(_basisModule);
  }).then(() => {
    _basisModule.initializeBasis();
  });
}

function transcodeBasisImage(basisBytes, transcodeFormats) {
  var basisFile = new _basisModule.BasisFile(new Uint8Array(basisBytes));

  const images = basisFile.getNumImages();
  const hasAlpha = basisFile.getHasAlpha();
  const numLevels = basisFile.getNumLevels(0);

  if (!images || !numLevels)
    return undefined;

  var transcodeFormat = hasAlpha ? transcodeFormats.rgba : transcodeFormats.rgb;

  if (!basisFile.startTranscoding())
    return undefined;

  var dimensions = [];
  var transcodedBuffers = [];
  for (var level = 0; level < numLevels; level++) {
    const width = basisFile.getImageWidth(0, level);
    const height = basisFile.getImageHeight(0, level);

    if (!width || !height)
      return undefined;

    dimensions.push({width, height});

    var transcodeSize = basisFile.getImageTranscodedSizeInBytes(0, level, transcodeFormat);
    var transcodeData = new Uint8Array(transcodeSize);
    if (!basisFile.transcodeImage(transcodeData, 0, level, transcodeFormat, 1, hasAlpha))
      return undefined;
    transcodedBuffers.push(transcodeData.buffer);
  }

  basisFile.close();
  basisFile.delete();

  return { buffers: transcodedBuffers, dimensions, hasAlpha };
}
`;
