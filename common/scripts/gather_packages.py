import sys, os, glob, re, subprocess
import shutil

def determineDistTag(branchName, currentVer, latestVer, previousVer):
  # The master branch is the only one that should get the 'nightly' release tag
  mainBranch = "master"
  print ("Branch name: " + branchName + "\nCurrent version: " + currentVer + "\nLatest version: " + latestVer + "\nPrevious version: " + previousVer)

  distTag = None
  # The most common case is the tag will be a nightly tag
  if mainBranch in branchName:
    distTag = "nightly"
  elif "release/" in branchName:
    print ("On a release branch")

    # Parse current version
    currentDevVer = -1
    if ("-" in currentVer):
      currentVer, currentDevVer = currentVer.split("-")
      currentDevVer = int(currentDevVer.split(".")[1])
    currentMajorVer, currentMinorVer, currentPatchVer = currentVer.split(".")
    currentMajorVer, currentMinorVer, currentPatchVer = int(currentMajorVer), int(currentMinorVer), int(currentPatchVer)

    # Parse latest version
    if (latestVer != ""):
      latestDevVer = -1
      if ("-" in latestVer):
        latestVer, latestDevVer = latestVer.split("-")
        latestDevVer = int(latestDevVer.split(".")[1])
      latestMajorVer, latestMinorVer, latestPatchVer = latestVer.split(".")
      latestMajorVer, latestMinorVer, latestPatchVer = int(latestMajorVer), int(latestMinorVer), int(latestPatchVer)

    # Parse previous version
    if (previousVer != ""):
      previousDevVer = -1
      if ("-" in previousVer):
        previousVer, previousDevVer = previousVer.split("-")
        latestDevVer = int(latestDevVer.split(".")[1])
      previousMajorVer, previousMinorVer, previousPatchVer = previousVer.split(".")
      previousMajorVer, previousMinorVer, previousPatchVer = int(previousMajorVer), int(previousMinorVer), int(previousPatchVer)

    if (currentDevVer != -1):
      # We shouldn't see a dev version for the current version except in the case of a release candidate
      distTag = "rc"
    else:
      if (latestVer == ""):
        # First release of new package
        distTag = "latest"
      else:
        if (currentMajorVer < latestMajorVer):
          if (previousVer == ""):
            # Latest major version is greater than current major version and no version is tagged 'previous' for this package,
            # assign 'previous' tag to this release.
            distTag = "previous"
          else:
            if (currentMajorVer > previousMajorVer):
              # Assign 'previous' tag to release on newer major version than previous version (this will happen when a new
              # major version is released, and this package is the first minor version/patch release on the old major version)
              distTag = "previous"
            elif (currentMajorVer == previousMajorVer):
              if (currentMinorVer >= previousMinorVer):
                # Assign previous tag to newer minor or patch release of previous major version
                distTag = "previous"
        elif (currentMajorVer > latestMajorVer):
          # First new major version release
          distTag = "latest"
        else:
          # If current minor version < 'latest', don't add dist tag (this shouldn't ever happen)
          if (currentMinorVer > latestMinorVer):
            # Assign 'latest' tag to new minor release
            distTag = "latest"
          elif (currentMinorVer == latestMinorVer):
            # Major/Minor versions are equal, assign 'latest' tag if new patch or first release
            if (currentPatchVer > latestPatchVer):
              # Assign 'latest' tag if new patch
              distTag = "latest"
            elif (currentPatchVer == latestPatchVer and latestDevVer != -1):
              # Assign 'latest' tag if first non rc release of package
              distTag = "latest"

  return distTag

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
