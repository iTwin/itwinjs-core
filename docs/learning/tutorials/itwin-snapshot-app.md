# iTwin Snapshot

[Snapshot iModels](../backend/AccessingIModels.md/#snapshot-imodels) are a static format representing the state of an iModel at a point in time. Once created, they can not be modified. And do not have a connection with iModelHub. Developers writing iTwin.js applications should enjoy several features of Snapshot iModels:

- No connection to iModelHub removes authentication and authorization obstacles
- Their offline nature allows all development to be done locally, with no network latency
- It is not required to have an iTwin Subscription to develop using them

Snapshot iModels should not be used in any production workflows as they do not provide security, change history, and other benefits of an iTwin Subscription.

The iTwin Snapshot app was designed with developers in mind. The free tool allows developers to create snapshots and after the snapshot has been created, it guides you to a viewer to visualize the snapshot. It also contains links to iTwin.js documentation and blogs.

[!bwc tile heading="Download iTwin Snapshot" link="https://autoupdatecdn.bentley.com/itsnp/client/iTwinSnapshot.exe" contents=" " icon="download.svg" step="13" width="20%"]

Further information on how to use iTwin Snapshot can be found in the ["Create a snapshot iModel"]($docs/learning/tutorials/create-test-imodel-offline.md) tutorial.
