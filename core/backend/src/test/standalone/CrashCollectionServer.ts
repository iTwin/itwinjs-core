/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as formidable from "formidable";
import * as http from "http";
import * as fs from "fs-extra";
import * as path from "path";

// tslint:disable:no-console

const uploadDir = path.join(__dirname, "files");
if (!fs.existsSync(uploadDir))
  fs.mkdirpSync(uploadDir);

http.createServer((req, res) => {

  // This if statement is here to catch form submissions, and initiate multipart form data parsing.

  if (req.url === "/crashreports" && req.method!.toLowerCase() === "post") {

    // Instantiate a new formidable form for processing.

    const form = new formidable.IncomingForm();
    form.uploadDir = uploadDir;

    if (!fs.existsSync(form.uploadDir))
      fs.mkdirpSync(form.uploadDir);

    // form.parse analyzes the incoming stream data, picking apart the different fields and files for you.

    form.parse(req, (err: any, fields, files) => {
      if (err) {

        // Check for and handle any errors here.

        console.error(err.message);
        return;
      }

      if (files.upload_file_minidump === undefined) {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("missing 'files.upload_file_minidump'");
      }
      const breakPadUpload = files.upload_file_minidump;

      const originalName = path.join(form.uploadDir, breakPadUpload.name);
      if (fs.existsSync(originalName))
        fs.unlinkSync(originalName);

      try {
        fs.renameSync(breakPadUpload.path, originalName);

        fs.appendFileSync(path.join(originalName + ".txt"), JSON.stringify(fields));

        console.log(originalName + " : " + JSON.stringify(fields));

        res.writeHead(200, { "content-type": "text/plain" });
        res.end(originalName + " : " + JSON.stringify(fields));
      } catch (err) {
        console.error(err);
      }
    });
    return;
  }

  // If this is a regular request, and not a form submission, then send the form.

  res.writeHead(200, { "content-type": "text/html" });
  res.end(
    '<form action="/crashreports" enctype="multipart/form-data" method="post">' +
    '<input type="text" name="title"><br>' +
    '<input type="file" name="upload" multiple="multiple"><br>' +
    '<input type="submit" value="Upload">' +
    "</form>",
  );
}).listen(3000, () => console.log("Listening on http://localhost:3000"));
