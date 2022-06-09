import os, subprocess
from platform import release

# Validate arguments
# command = "npm view " + packageName + " dist-tags.previous"
# proc = subprocess.Popen(command, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
# previousVer = proc.communicate()[0]
# if len(previousVer) == 0:
#   print("No version found for dist-tag 'previous'")

def getSHAFromTag(tag):
  cmd = ["git", "rev-list", "-n", "1", tag]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  sha = proc.communicate()[0].decode("utf-8").strip()
  if len(sha) == 0:
    print("Could not find commit for tag '{0}'".format(tag))
    return ""

  return sha

def getCommitMessage(sha):
  cmd = ["git", "log", "-1", "--format='%s'", sha]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commitMessage = proc.communicate()[0].decode("utf-8").strip()
  if len(commitMessage) == 0:
    print("Could not find commit " + sha)
    return ""
  return commitMessage[1:-1]

def createRelease(previousTag, currentTag):
  # Parse versions from tags
  previousVer = previousTag.split("/")[1]
  currentVer = currentTag.split("/")[1]

  parsedVer = [int(i) for i in currentVer.split(".")]
  print(parsedVer)


  # Determine if this is a patch release
  releaseType = ""
  if parsedVer[2] > 0:
    releaseType = "Patch"
  elif parsedVer[1] > 0:
    releaseType = "Minor"
  else:
    releaseType = "Major"

  # If patch release, get previous tag
  if releaseType == "Patch":
    print("Patch release")

  # If major/minor release

  # Get SHAs for both tags
  previousSHA = getSHAFromTag(previousTag)
  currentSHA = getSHAFromTag(currentTag)

  # Get all commit SHAs between tags
  cmd = ["git", "rev-list", "--ancestry-path", previousSHA + ".." + currentSHA]
  proc = subprocess.Popen(cmd, stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commits = proc.communicate()[0].decode("utf-8").split()[1:]

  # Write release to file to preview
  f = open("release.md", "w")
  f.write("# {0} {1} Release\n\n".format(currentVer, releaseType))
  if releaseType != "Patch":
    f.write("For detailed list of changes see the [detailed changelog.](./docs/changehistory/{0}.md)".format(currentVer))
  f.write("## Changes\n\n")
  for commit in commits[::-1]:
    f.write("- {0}\n".format(getCommitMessage(commit)))
  f.write("\n**Full changelog:** [{0}...{1}](https://github.com/iTwin/itwinjs-core/compare/{2}...{3})\n".format(previousVer, currentVer, previousTag, currentTag))
  f.close()


# Delete file if it exists
if os.path.exists("release.md"):
  os.remove("release.md")

createRelease("release/3.2.0", "release/3.2.1")
# createRelease("release/3.2.1")

# getCommitInfo("640a0436b5272253d1ad03ade8d845a898205c12")
