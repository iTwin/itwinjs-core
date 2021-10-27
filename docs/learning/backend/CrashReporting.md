# Crash Reporting

Along with logging, crash dumps and node-reports are an important source of information to help diagnose the cause of fatal errors in Web app backends, services, and agents. Such reports are disabled by default. They require careful handling, since they may contain sensitive information about the program. As long as adequate security can be maintained, it is recommended that a backend program should enable both crash dumps and node-reports. Here is a description of how to do that.

## Opting into Crash Reporting

To opt into crash dumps and/or node-report, the backend program must:

- Define the [IModelHostConfiguration]($backend).crashReportingConfig property when configuring IModelHost.
- The crashDir property must be set.

See [CrashReportingConfig]($backend) for all of the options.

## Native-Code Crashes

An unhandled exception in the native-code portion of imodeljs-backend or any addon will cause the backend program to terminate prematurely. The backend can cause a crash dump to be written in such an event. A crash dump contains information about what native code was running at the time of the crash, including native call stacks for all threads, and may also contain a copy of the contents of memory.

<!-- WIP On Windows, crash dumps will be in the Microsoft mini-dump format and can be analyzed by a variety of debugging tools.
On Linux ...?
-->

To opt into crash dumps, the backend program must:

- Set the [IModelHostConfiguration]($backend).crashReportingConfig.enableCrashDumps to true.

## Unhandled Exceptions and Other Fatal Errors

An unhandled exception or a fatal error such as running out of memory will cause the backend program to terminate prematurely. The backend program can enable the "node-report" module to generate a report in case of these events. A node-report file is a human-readable text file that includes native-code and Javascript call stacks, plus other information about the state of the session. See <https://www.npmjs.com/package/node-report> for details.

To opt into node-report, the backend program must:

- Set [IModelHostConfiguration]($backend).crashReportingConfig.enableNodeReport = true
- Add a dependency on [node-report](https://www.npmjs.com/package/node-report) to your package.json file.
- Install the prerequisites for [node-gyp](https://www.npmjs.com/package/node-gyp) on the machine where you run npm install.
- If you Webpack, specify "api.node" as an external dependency.

## Uploading Reports

Crash dump and/or node-report files will be written to the directory specified by the [IModelHostConfiguration]($backend).crashReportingConfig.crashDir directory. If you can access that location directly, that may be enough. You can check that directory periodically to detect crashes.

You may also supply a script to process dump and node-report files. See [IModelHostConfiguration]($backend).crashReportingConfig.dumpProcessorScriptFileName. Typically, this script would upload the specified file to a crash dump service for further analysis and reporting.

If you set [IModelHostConfiguration]($backend).crashReportingConfig.uploadToBentley, then all dump and node-report files will be uploaded to and stored in Bentley's crash-reporting service.

## Example Code

```ts
// Enable both crash dumps and node-report. Write reports to d://customdumpdir on Windows
hostConfig.crashReportingConfig = {
  crashDir: (process.platform == "win32")? "d:\\customdumpdir": "/tmp";
  writeDumpsToCrashDir: true,
  writeNodeReportsToCrashDir: true,
};

IModelHost.startup(hostConfig);
```
