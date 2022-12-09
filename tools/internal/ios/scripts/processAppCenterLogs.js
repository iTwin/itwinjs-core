/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const https = require('https');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const app_center_host = 'api.appcenter.ms';
const app_center_api_ver = "v0.1";
const owner_name = process.argv[2];       // app_center_owner;
const app_name = process.argv[3];         // app_center_app;
const api_token = process.argv[4];        // app_center_token;
const lib_directory = process.argv[5];    // lib_directory (for output)

const test_id = require(path.relative(__dirname, `${lib_directory}/run_output.json`))[0].testRunId;

const xmlFilter = "[Mocha_Result_XML]: ";
const deviceLogsPath = "device_logs.txt"
const resultsPath = `${lib_directory}/junit_results.xml`

async function fetchTestReportInfo() {
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

async function downloadDeviceLogs(url, dest, cb) {
  return new Promise((resolve, reject) => {
    try {
      console.info(`Downloading device log from app-center ${url}`);
      if (fs.existsSync(dest)) {
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

function extractXML(xmlFilter, inputLogFile, outputXmlFile) {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputLogFile),
    crlfDelay: Infinity
  });
  const outputStream = fs.createWriteStream(outputXmlFile)

  rl.on('line', (line) => {
    if (line.includes(xmlFilter)) {
      let xmlLine = line.substring(line.indexOf(xmlFilter) + xmlFilter.length);

      var regex = /\\M-b\\M\^@\\M-&/g;
      let cleanedXmlLine = xmlLine.replace(regex, "...");

      outputStream.write(cleanedXmlLine + "\n", "utf-8");
      console.log(cleanedXmlLine);
    }
  });
}

(async function () {
  const testReport = await fetchTestReportInfo();
  console.log("Fetched test report info.")
  console.info(JSON.stringify(testReport, undefined, 2));

  const deviceLogUrl = testReport.device_logs[0].device_log;
  await downloadDeviceLogs(deviceLogUrl, deviceLogsPath);
  console.log("Downloaded device logs.")

  extractXML(xmlFilter, deviceLogsPath, resultsPath);
  console.log("Extracted XML from device logs.")
})();