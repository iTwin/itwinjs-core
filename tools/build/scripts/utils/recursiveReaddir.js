/**
 * Adapted from:
 *
 * recursive-readdir
 * By Jamison Dance / GitHub User jergason
 * Source: https://github.com/jergason/recursive-readdir
 *
 * Licensed under the MIT License.
 * See tools\build\ThirdPartyNotices.md for full license.
 */

var fs = require("fs");
var p = require("path");

function matchesFile(ignorePath) {
  return function (path, stats) {
    return stats.isFile() && ignorePath === path;
  };
}

function toMatcherFunction(ignoreEntry) {
  if (typeof ignoreEntry == "function") {
    return ignoreEntry;
  } else {
    return matchesFile(ignoreEntry);
  }
}

function readdir(path, ignores, callback) {
  if (typeof ignores == "function") {
    callback = ignores;
    ignores = [];
  }

  if (!callback) {
    return new Promise(function (resolve, reject) {
      readdir(path, ignores || [], function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  ignores = ignores.map(toMatcherFunction);

  var list = [];

  fs.readdir(path, function (err, files) {
    if (err) {
      return callback(err);
    }

    var pending = files.length;
    if (!pending) {
      // we are done, woop woop
      return callback(null, list);
    }

    files.forEach(function (file) {
      var filePath = p.join(path, file);
      fs.stat(filePath, function (_err, stats) {
        if (_err) {
          return callback(_err);
        }

        if (
          ignores.some(function (matcher) {
            return matcher(filePath, stats);
          })
        ) {
          pending -= 1;
          if (!pending) {
            return callback(null, list);
          }
          return null;
        }

        if (stats.isDirectory()) {
          readdir(filePath, ignores, function (__err, res) {
            if (__err) {
              return callback(__err);
            }

            list = list.concat(res);
            pending -= 1;
            if (!pending) {
              return callback(null, list);
            }
          });
        } else {
          list.push(filePath);
          pending -= 1;
          if (!pending) {
            return callback(null, list);
          }
        }
      });
    });
  });
}

module.exports = {
  readdir
};
