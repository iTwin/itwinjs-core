/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

var numFailed = -1;

mocha.run(function (numTestsFailed) {
  numFailed = numTestsFailed;
});

process.on('exit', function () {
  process._linkedBinding("iModelJsMobile").notifyListening(numFailed);
});