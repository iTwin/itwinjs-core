/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const https = require('https');
const fs = require('fs');
const es = require('event-stream');
const path = require('path');
const app_center_host = 'api.appcenter.ms';
const app_center_api_ver = "v0.1";
const owner_name = process.argv[2]; // app_center_owner;
const app_name = process.argv[3]; //app_center_app;
const api_token = process.argv[4];  // app_center_token;
const log_dir = path.join(findPackageRootDir(), "lib/test/ios");
const deviceLogFile = path.join(log_dir, "device.log");
const appLogFile = path.join(log_dir, "app.log");
const appFilter = /^imodeljs-backend-test-app\(libiModelJsHostM02.dylib\)/i;

/** Find package root folder where package.json exist */
function findPackageRootDir(dir = __dirname) {
  if (!fs.existsSync(dir))
    return undefined;

  for (const entry of fs.readdirSync(dir)) {
    if (entry === "package.json") {
      return dir;
    }
  }
  return findPackageRootDir(path.join(dir, ".."));
}

/* WIP
async function deleteTestRun(test_id) {
  return new Promise((resolve, reject) => {
    const options = {
      host: app_center_host,
      path: `/${app_center_api_ver}/apps/${owner_name}/${app_name}/test_runs/${test_id}`,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-API-Token': api_token,
      },
    };
    const req = https.request(options, function (res) {
      res.setEncoding('utf-8');
      res.on("error", (err) => {
        reject(err);
      });
      res.on('end', () => {
        resolve();
      });
    });
    req.write("");
    req.end();
  });
}
*/
async function getTestReportInfo(test_id) {
  return new Promise((resolve, reject) => {
    const options = {
      host: app_center_host,
      path: `/${app_center_api_ver}/apps/${owner_name}/${app_name}/test_runs/${test_id}/report`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-API-Token': api_token,
      },
    };
    const req = https.request(options, function (res) {
      res.setEncoding('utf-8');
      let responseString = '';

      res.on('data', (data) => {
        responseString += data;
      });
      res.on("error", (err) => {
        reject(err);
      });
      res.on('end', () => {
        const responseObject = JSON.parse(responseString);
        resolve(responseObject);
      });
    });
    req.write("");
    req.end();
  });
}
/** Download text content and save it to disk */
async function downloadTextFile(url, dest, cb) {
  return new Promise((resolve, reject) => {
    try {
      console.info(`Downloading device log from app-center ${url}`);
      if (fs.existsSync(dest)) {
        // help full in debugging but not required on azure-ci-worker
        fs.unlinkSync(dest)
      }
      const file = fs.createWriteStream(dest);
      https.get(url, function (response) {
        response.pipe(file);
        file.on('finish', () => {
          console.info(`Device log saved to ${dest}`);
          file.close(cb);
          resolve();
        });
        response.on('error', err => {
          reject(err);
        })
      });
    } catch (err) {
      reject(err);
    }
  });
}
function getTestRunId(test_run_log_file) {
  return require(test_run_log_file)[0].testRunId;
}

async function filterAppLog(loggerTest, inputLogFile, outputLogFile) {
  return new Promise((resolve, reject) => {
    console.info(`Filtering out app log and writing it into ${outputLogFile}`);
    let logEntry = "";
    let logPrefix = "";
    const f = fs.createWriteStream(outputLogFile)
    const s = fs.createReadStream(inputLogFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        s.pause();
        //Nov  6 21:50:28 iPad imodeljs-backend-test-app(libiModelJsHostM02.dylib)[235] <Notice>:"
        const m = line.match(/^(\w+\s+\d+\s+\d+:\d+:\d+)\s+\w+\s+([^\s]+)\s+[^\s]+:/);
        if (m) {
          const loggerName = m[2];
          if (loggerName.match(loggerTest)) {
            if (logEntry !== "") {
              f.write(logEntry + "\n", "utf-8");
            }
          }

          logEntry = m[1] + ':' + line.substring(m[0].length);
          logPrefix = " ".repeat(m[1].length + 2);
        } else {
          if (logEntry !== "")
            logEntry += "\n" + logPrefix + line;
          else
            logEntry = line;
        }

        // resume the readstream, possibly from a callback
        s.resume();
      })
        .on('error', function (err) {
          reject(err);
        })
        .on('end', function () {
          if (logEntry !== "") {
            f.write(logEntry + "\n", "utf-8");
          }
          f.close();
          resolve();
        })
      );
  });
}

function writeToConsole(loglevel, logEntry) {
  if (logEntry !== "") {
    if (loglevel === "INFO")
      console.info(logEntry);
    else if (loglevel === "ERROR")
      console.error(logEntry);
    else if (loglevel === "WARN")
      console.warn(logEntry);
    else if (loglevel === "DEBUG")
      console.debug(logEntry);
    else if (loglevel === "TRACE")
      console.trace(logEntry);
    else
      console.log(logEntry);
  }
}
async function outputMochaLog(inputLogFile) {
  return new Promise((resolve, reject) => {
    console.info(`Filtering mocha test log ${inputLogFile}`);
    let logEntry = "";
    let loglevel = "";
    const s = fs.createReadStream(inputLogFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        s.pause();
        //Nov  6 21:50:28: MOCHA ERROR message"
        //Nov  8 16:28:32: [MOCHA ERROR]    [FAILED] ORed ECEnums

        const m = line.match(/^\w+\s+\d+\s+\d+:\d+:\d+\s*:\s*\[MOCHA\s+(\w+)\]/i);
        if (m) {
          writeToConsole(loglevel, logEntry);
          loglevel = m[1].toUpperCase();
          logEntry = line.substring(m[0].length);
        } else {
          if (line.match(/^\w+\s+\d+\s+\d+:\d+:\d+\s*:/i)) {
            // ignore
          } else {
            if (logEntry !== "")
              logEntry += "\n" + line;
            else
              logEntry = line;
          }
        }

        // resume the readstream, possibly from a callback
        s.resume();
      })
        .on('error', function (err) {
          reject(err);
        })
        .on('end', function () {
          writeToConsole(loglevel, logEntry);
          resolve();
        })
      );
  });
}

(async function () {
  const test_id = getTestRunId(path.join(log_dir, "test_run.json"));
  const testReport = await getTestReportInfo(test_id);
  console.info(JSON.stringify(testReport, undefined, 2));
  const deviceLogUrl = testReport.device_logs[0].device_log;
  await downloadTextFile(deviceLogUrl, deviceLogFile);
  await filterAppLog(appFilter, deviceLogFile, appLogFile);
  await outputMochaLog(appLogFile);
})();
