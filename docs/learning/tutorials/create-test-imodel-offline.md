# Create a snapshot iModel

Get started with iModel.js in your local environment. It is free, with no iTwin subscription requirement or trial periods.

[Snapshot iModels]($docs/learning/backend/accessingimodels.md/#snapshot-imodels) are a static but intelligent format representing the state of an iModel at a point in time. Once created, they can not be modified. And do not have a connection with iModelHub.


## Download iTwin synchronizer

[Download](https://www.bentley.com/en/resources/software/itwin-synchronizer) and familiarize yourself with the [iTwin Synchronizer](https://www.bentley.com/en/Products/Product-Line/Digital-Twins/iTwin-Synchronizer), a free tool for synchronizing data in CAD/BIM files on your desktop and an iModel.

## Create a snapshot iModel
1. Launch iTwin Synchronizer
1. Click the gear in the upper right
1. Select "Generate snapshots"
1. Provide a name for the snapshot
1. Choose where to save the snapshot on your local drive
1. Select local files by clicking "+"
1. Click "Generate"
1. Enable any required bridges

The iTwin Synchronizer will download and extract the needed bridges, run the bridges on the selected files, and generate the snapshot to the chosen location.

---

<style>
    a#getting-started---explore-imodel {
        display: none;
    }
</style>