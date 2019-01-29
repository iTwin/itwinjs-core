# 0.189.0-dev.9 Change Notes

## Changes to IModelConnection
* In the case of ReadWrite connections, IModelConnection.close() now always disposes the briefcase held at the backend. Applications must ensure that any changes are saved and pushed out to the iModelHub before making this call.
* IModelConnection.connectionTimeout is now public, allowing applications to customize this in the case of slow networks.
