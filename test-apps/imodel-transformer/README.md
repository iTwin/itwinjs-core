# imodel-transformer

## About this Application

The application contained within this directory is a test application for transforming iModels.

Example command line:

`npm start -- --sourceFile=<sourceIModelFileName> --targetFile=<targetIModelFileName>`

To get usage help run:

`npm start -- --help`

## imodel-transformer as a sample application

This application demonstrates the following:

- Using the `IModelTransformer` API
- Calling the `ContextRegistry` API to get *context* (project or asset) information
- Querying `IModelHub` to get iModel information
- How to handle either *briefcase* or *snapshot* iModel in the same application
- Using [yargs](http://yargs.js.org/) to handle command line arguments

## imodel-transformer as a support tool

In addition to being an example of how to use the `IModelTransformer` API within an application, `imodel-transformer` is also a useful support tool.
It can be used to investigate issues reported against the `IModelTransformer` API.
A common scenario is a generic report (with minimal details) of IModelTransformer throwing an Error before running to successful completion.
Here are the steps that can be used:

- Ask to be invited to the project/asset context that contains the iModel. This is straightforward in *QA* and *DEV* but may require more legwork for a user iModel in *PROD*.
- After being invited, your name should show up in the "Team Members" list. If it does not, you may not have the required permissions to pull a briefcase of the iModel.
- Get the GUID of the contextId and the GUID of the iModelId. Both should be available in the URL used by Design Review to view the iModel.
- Optionally, you can turn on verbose iModel transformation-related logging with the `--logTransformer` option.
- Set the appropriate options either on the command line or by editing the `imodel-transformer (app)` launch configuration within `launch.json` (in the root imodeljs directory)
  - `--hub='qa'` (or 'dev' or 'prod')
  - `--logTransformer`
  - `--sourceContextId='<context GUID>'`
  - `--sourceIModelId='<iModel GUID>'`
  - `--targetFile='<full path to file on local computer>'`

A common strategy is to run with verbose logging on to find the problem element or spot where the problem occurs.
Once the problem area has been identified, you can employ various strategies to set a conditional breakpoint.
One possibility is to edit the `onTransformElement` method in `Transformer.ts` to add a `if (sourceElement.getDisplayLabel() === "x")` or `if (sourceElement.id === "x")` conditional (using information from the log output) around a "hit problem area" log function call and then set a breakpoint on that log message.
After rebuilding, re-running, and hitting the breakpoint, you can then step into the core IModelTransformer methods to see what is really going on.
