---
publish: false
---
# NextVersion

- [Cloud storage changes](#cloud-storage-changes)

## Cloud storage changes

The existing beta implementation of cloud storage tile cache ([CloudStorageService]($backend) - [AzureBlobStorage]($backend), [AliCloudStorageService]($backend)) has been deprecated in favor of the [iTwin/object-storage](https://github.com/iTwin/object-storage) project, which exposes a unified cloud-agnostic object storage interface in turn simplifying the setup of Microsoft Azure or S3 based (OSS, MinIO) cloud storage providers.

[CloudStorageService]($backend) remains to support older frontends, however the new implementation of cloud storage still has to be setup. This is done automatically if [IModelHostOptions.tileCacheAzureCredentials]($backend) are used.

A different cloud provider may be set in [IModelHostOptions.tileCacheStorage]($backend), which could be any of [the implementations iTwin/object-storage](https://github.com/iTwin/object-storage/tree/main/storage) provides.
