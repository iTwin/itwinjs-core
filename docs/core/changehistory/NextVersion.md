---
ignore: true
---
# NextVersion

In the case of ReadWrite connections, IModelConnection.close() now always disposes the briefcase held at the backend. Applications must ensure that any changes are saved and pushed out to the iModelHub before making this call.
