/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/**
 * @param {Object} params
 * @param {SpriteSymbol} params.symbol - Sprite symbol instance {@see https://git.io/v9k8g}
 * @param {SVGSpriteLoaderConfig} params.config - Parsed loader config
 * @param {string} params.context - Context folder of current processing module
 * @param {Object} params.loaderContext {@see https://webpack.js.org/api/loaders/#the-loader-context}
 * @return {string}
 */
function runtimeGenerator(params) {
  return `module.exports = __webpack_public_path__ + ${JSON.stringify(params.symbol.request.file)};`;
}
  
module.exports = runtimeGenerator;