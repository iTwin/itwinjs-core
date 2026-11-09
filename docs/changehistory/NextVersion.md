---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Stricter briefcase file deletion](#stricter-briefcase-file-deletion)

## Backend

### Stricter briefcase file deletion

[NativeApp.deleteBriefcase]($frontend) now only deletes files that are inside the briefcase cache directory or that are valid iModels. If the supplied path refers to an existing file that is neither, it throws an [IModelError]($common) with [IModelStatus.BadRequest]($bentley) and deletes nothing. If the path does not exist and is outside the briefcase cache, the call does nothing.

[BriefcaseManager.deleteBriefcaseFiles]($backend) no longer deletes every file in the same directory whose name starts with the briefcase's file name. Only files named `<briefcase file name>-*` or `<briefcase file name>.*` (e.g. `-wal`, `-shm`, `-locks`, `.Tiles`) are deleted along with the briefcase.
