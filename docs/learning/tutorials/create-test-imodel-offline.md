# Create a local iModel

Get started with iModel.js in your local environment. It is free, with no iTwin subscription requirement or trial periods.

[Snapshot iModels]($docs/learning/backend/accessingimodels.md/#snapshot-imodels) are a static but intelligent format representing the state of an iModel at a point in time. Once created, they can not be modified. And do not have a connection with iModelHub.


## Download iTwin synchronizer

Download and familiarize yourself with the [iTwin Synchronizer](https://www.bentley.com/en/Products/Product-Line/Digital-Twins/iTwin-Synchronizer), a free tool for synchronizing data in CAD/BIM files on your desktop and an iModel.

## Create snapshot a iModel
- Launch iTwin Synchronizer
- Click the gear in the upper right
- Select "Generate snapshots"
- Provide a name for the snapshot
- Choose where to save the snapshot on your local drive
- Select local files by clicking "+"
- Click "Generate"
- Enable any needed bridges

The iTwin Synchronizer will download and extract the needed bridges, run the bridges on the selected files, and generate the snapshot to the chosen location.

---

<style>
    a#getting-started---explore-imodel {
        display: none;
    }
</style>