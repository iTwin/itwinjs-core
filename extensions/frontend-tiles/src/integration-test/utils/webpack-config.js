// /*---------------------------------------------------------------------------------------------
//  * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
//  * See LICENSE.md in the project root for license terms and full copyright
//  *notice.
//  *--------------------------------------------------------------------------------------------*/

const path = require('path');
const {globSync} = require('glob');
const frontendLib = path.resolve(__dirname, '../../../lib/cjs');
const Dotenv = require('dotenv-webpack');

module.exports = {
  mode : 'development',
  entry : globSync(path.resolve(frontendLib, 'integration-test/**/*.test.js'), {
          windowsPathsNoEscape : true,
        }),
  output : {
    path : path.resolve(frontendLib, 'test/webpack/'),
    filename : 'bundled-integration-tests.js',
    devtoolModuleFilenameTemplate : 'file:///[absolute-resource-path]'
  },
  devtool : 'nosources-source-map',
  module : {
    noParse :
            [
              // Don't parse draco_*_nodejs.js modules for `require` calls.
              // There are requires for fs that cause it to fail even though the
              // fs dependency is not used.
              /draco_decoder_nodejs.js$/, /draco_encoder_nodejs.js$/
            ],
    rules :
    [
      {test : /\.js$/, use : 'source-map-loader', enforce : 'pre'},
      {
        test : /azure-storage|AzureFileHandler|UrlFileHandler/,
        use : 'null-loader'
      },
    ]
  },
  stats : 'errors-only',
  optimization : {nodeEnv : 'production'},
  externals : {
    electron : 'commonjs electron',
  },
  plugins :
          [
            new Dotenv(),
          ],
};
