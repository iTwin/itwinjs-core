import os, subprocess, sys

def getSHAFromTag(tag):
  cmd = ["git", "rev-list", "-n", "1", tag]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  sha = proc.communicate()[0].decode("utf-8").strip()
  if len(sha) == 0:
    print("Could not find commit for tag '{0}'".format(tag))
    return ""

  return sha

def getCommitMessage(sha):
  cmd = ["git", "log", "-1", "--format=%s", sha]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commitMessage = proc.communicate()[0].decode("utf-8").strip()
  if len(commitMessage) == 0:
    print("Could not find commit " + sha)
    return ""
  return commitMessage

# Tag assumed to be of format release/x.x.x
def createRelease(tag):
  # Parse versions from tags
  currentVer = tag.split("/")[1]
  parsedVer = [int(i) for i in currentVer.split(".")]

  # Determine release type
  if parsedVer[2] > 0:
    releaseType = "Patch"
  elif parsedVer[1] > 0:
    releaseType = "Minor"
  else:
    releaseType = "Major"

  # If patch release, get previous tag, otherwise if major/minor release
  # get latest tag for previous major/minor version
  if releaseType == "Patch":
    cmd = ["git", "describe", "--abbrev=0", "--tags", tag + "~1"]
    proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    previousTag = proc.communicate()[0].decode("utf-8").strip()
    if (len(previousTag) == 0):
      print("Could not find previous tag for " + tag)
  else:
    if releaseType == "Minor":
      glob = "refs/tags/release/{0}.{1}.*".format(parsedVer[0], parsedVer[1] - 1)
    else:
      glob = "refs/tags/release/{0}.*".format(parsedVer[0] - 1)
    cmd = ["git", "for-each-ref", "--sort=-taggerdate", "--count=1", "--format=%(refname:short)", glob]
    proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    previousTag = proc.communicate()[0].decode("utf-8").strip()
  if (len(previousTag) == 0):
    print("Could not find previous tag for " + tag)

  previousVer = previousTag.split("/")[1]

  # Get SHAs for both tags
  previousSHA = getSHAFromTag(previousTag)
  currentSHA = getSHAFromTag(tag)

  # Get all commit SHAs between tags
  cmd = ["git", "rev-list", "--ancestry-path", previousSHA + ".." + currentSHA]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commits = proc.communicate()[0].decode("utf-8").split()[1:]

  # Write release to file to preview
  fileName = currentVer + ".md"
  if os.path.exists(fileName):
    os.remove(fileName)

  f = open(fileName, "w")
  f.write("# Release notes\n\n")
  if releaseType != "Patch":
    f.write("For detailed list of changes see the [detailed change notes.](./docs/changehistory/{0}.md)\n\n".format(currentVer))
  f.write("## Changes\n\n")
  for commit in commits[::-1]:
    f.write("- {0}\n".format(getCommitMessage(commit)))
  f.write("\n**Full changelog:** [{0}...{1}](https://github.com/iTwin/itwinjs-core/compare/{2}...{3})\n".format(previousVer, currentVer, previousTag, tag))
  f.close()

  # Publish the release
  cmd = ["gh", "release", "create", tag, "-F", fileName, "-t", "{0} {1} Release".format(currentVer, releaseType)]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  proc.wait()

## Validate arguments
if len(sys.argv) != 2:
  sys.exit("Invalid number of arguments to script provided.\nExpected: 1\nReceived: {0}".format(len(sys.argv) - 1))

releaseTag = sys.argv[1]

print("Creating release for " + releaseTag)

createRelease(releaseTag)

# createRelease("release/3.2.0", "release/3.2.1")
# createRelease("release/3.2.1")
# createRelease("release/3.0.1")
# createRelease("release/3.2.0")
# createRelease("release/3.0.0")

# getCommitInfo("640a0436b5272253d1ad03ade8d845a898205c12")
