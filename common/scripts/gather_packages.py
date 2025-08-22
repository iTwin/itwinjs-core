import sys, os, glob, re, subprocess
import shutil

def determineDistTag(branchName, currentVer, latestVer, previousVer):
  return "experimental"

## Validate arguments
if len(sys.argv) != 4:
  sys.exit("Invalid number of arguments to script provided.\nExpected: 3\nReceived: {0}".format(len(sys.argv) - 1))
artifactStagingDir = os.path.realpath(sys.argv[1])
sourcesDirectory = os.path.realpath(sys.argv[2])
branchName = sys.argv[3]

## Setup
stagingDir = os.path.join(artifactStagingDir, "imodeljs", "packages")
os.makedirs(stagingDir)

packageDir = os.path.join(sourcesDirectory, "common", "temp", "artifacts", "packages")

artifactPaths = glob.glob(os.path.join(packageDir, "*.tgz"))

packagesToPublish = False
localVer = ""
latestVer = ""
previousVer = ""
for artifact in artifactPaths:
  baseName = os.path.basename(artifact)
  print ("")
  print ("Checking package: '" + baseName + "'...")

  localVer = re.search(r'(\d\.\d.*).tgz', baseName)
  localVer = localVer.group(1)

  packageName = baseName[:(len(baseName) - len(localVer) - 5)]
  packageName = "@" + packageName.replace("-", "/", 1)

  command = "npm view " + packageName + "@" + localVer + " version"
  proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)

  # We are going to assume if a version is provided back from the above call, that this version exists
  # on the server.  Otherwise, it returns an empty string.
  serverVer = proc.communicate()[0]

  if proc.returncode != 0:
    packagesToPublish = True
    print ("Local version is newer than on the server.  Copying package " + packageName + " to staging area.")
    shutil.copy(artifact, stagingDir)

  if 0 != len(serverVer):
    print ("The version already exists.  Skipping...")
    continue

  if (latestVer == "" or previousVer == ""):
    command = "npm dist-tag ls " + packageName
    proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    distTags = proc.communicate()[0]
    if len(distTags) == 0:
      print("error getting dist-tags")

    tags = distTags.decode().split('\n')
    for tag in tags:
      if not len(tag) == 0:
        [distTag, ver] = tag.split(':')
        if distTag == "latest":
          latestVer = ver
        elif distTag == "previous":
          previousVer = ver

if packagesToPublish:
  distTag = determineDistTag(branchName, localVer, latestVer, previousVer)
  if distTag is not None:
    print ("Setting dist tag " + distTag)
    print ("##vso[build.addbuildtag]dist-tag " + distTag)
    print ("##vso[task.setvariable variable=isRelease;isSecret=false;isOutput=true;]true")

  print ("There are packages to publish.")
  print ("##vso[build.addbuildtag]package-release")
  print ("##vso[task.setvariable variable=isRelease;isSecret=false;isOutput=true;]true")
else:
  print ("All packages are up-to-date.")

## Tests
# print("nightly" == determineDistTag("master", "3.1.0-dev.0", "3.0.0", "2.19.28"))
# print("nightly" == determineDistTag("master", "3.1.0-dev.0", "3.0.0", ""))
# print("nightly" == determineDistTag("master", "3.1.0-dev.0", "", ""))
# print("nightly" == determineDistTag("master", "", "", ""))
# print(None == determineDistTag("release/3.1.x", "3.1.0", "3.2.1", "2.19.24"))
# print("previous" == determineDistTag("release/2.19.x", "2.19.25", "3.2.1", "2.19.24"))
# print("latest" == determineDistTag("release/3.2.x", "3.2.1", "3.1.0", "2.19.24"))
# print("latest" == determineDistTag("release/3.1.x", "3.1.1", "3.1.0", "2.19.24"))
# print("rc" == determineDistTag("release/3.1.x", "3.1.1-dev.0", "3.1.0", "2.19.24"))
# print(None == determineDistTag("release/2.18.x", "2.18.4", "3.1.0", "2.19.24"))
# print(None == determineDistTag("release/3.0.x", "3.0.1", "3.1.0", "2.19.24"))
# print("latest" == determineDistTag("release/2.19.x", "2.19.27", "2.19.26", ""))
# print("previous" == determineDistTag("release/3.0.x", "3.0.1", "4.0.0", ""))
# print(None == determineDistTag("release/3.0.x", "3.0.1", "3.1.0", ""))
# print("latest" == determineDistTag("release/3.0.x", "3.0.0", "", ""))
# print("rc" == determineDistTag("release/3.0.x", "3.0.0-dev.0", "", ""))
# print("latest" == determineDistTag("release/3.0.x", "3.0.0", "3.0.0-dev.0", ""))
# print("latest" == determineDistTag("release/3.0.x", "3.0.0", "3.0.0-dev.0", "2.19.26"))
