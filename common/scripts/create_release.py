import os, re, subprocess, sys, string

def getSHAFromTag(tag):
  cmd = ['git', 'rev-list', '-n', '1', tag]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  sha = proc.communicate()[0].decode("utf-8").strip()
  if len(sha) == 0:
    sys.exit("Could not find commit for tag '{0}'".format(tag))
  return sha

def getCommitMessage(sha):
  cmd = ['git', 'log', '-1', '--format=%s', sha]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  commitMessage = proc.communicate()[0].decode("utf-8").strip()
  if len(commitMessage) == 0:
    sys.exit("Could not find info for commit " + sha)

  # If commit message contains multiple PR links (in case of backports), remove the earlier one
  pattern = " \(#\d+\)"
  if len(re.findall(pattern, commitMessage)) > 1:
    commitMessage = re.sub(pattern, "", commitMessage, 1)
  return commitMessage

# Replaces relative image links with complete URLs
def replace_image_links(file_path):
    with open(file_path, 'r+') as f:
        content = f.read()

        # Use Linux path format
        content = content.replace('\\', '/')

        # Replace the "./assets" part of the image links with the correct URL
        updated_content = re.sub(r'!\[(.*?)\]\(\./assets(.*?)\)', r'![\1](https://github.com/iTwin/itwinjs-core/raw/master/docs/changehistory/assets\2)', content)

        # Move the file cursor to the beginning and truncate the file
        f.seek(0)
        f.truncate()

        # Write the updated content back to the file
        f.write(updated_content)

# Convert headings to HTML
# Needed because github release markdown doesn't support linking within a document
def convert_markdown_headings_to_html(file_path):

    # Read the Markdown file
    with open(file_path, 'r') as f:
        markdown_text = f.read()

    heading_counts = {}

    def replace_heading(match):
        heading_text = match.group(2).strip().lower()
        if heading_text in heading_counts:
            heading_counts[heading_text] += 1
        else:
            heading_counts[heading_text] = 1

        heading_id = generate_id(heading_text, heading_counts[heading_text])

        return f'<h{len(match.group(1))} id="{heading_id}">{match.group(2)}</h{len(match.group(1))}>'

    html_text = re.sub(
        r'^(#+)\s+(.*)$',
        replace_heading,
        markdown_text,
        flags=re.MULTILINE
    )

    # Update the Markdown file with the modified content
    with open(file_path, 'w') as f:
        f.write(html_text)

def generate_id(heading_text, count=None):
    # Remove leading/trailing whitespace
    heading_text = heading_text.strip()

    # Generate a valid id attribute from the heading text
    heading_text = heading_text.lower().translate(
        str.maketrans('', '', string.punctuation.replace('-', ''))
    )
    heading_text = heading_text.replace(' ', '-')

    # Add count suffix if there are multiple occurrences of the heading name
    if count is not None and count > 1:
        heading_text += f'-{count - 1}'

    return heading_text

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
  print("Generating {0} release notes".format(releaseType.lower()))

  if releaseType == "Patch":

    # Write release to file to preview
    fileName = currentVer + ".md"
    if os.path.exists(fileName):
      os.remove(fileName)

    f = open(fileName, "w")
    f.write("# Release notes\n\n")

    # Determine previous tag and version
    cmd = ['git', 'describe', '--abbrev=0', '--tags', tag + '~1']
    proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    previousTag = proc.communicate()[0].decode("utf-8").strip()
    if (len(previousTag) == 0):
      sys.exit("Could not find previous tag for " + tag)

    previousVer = previousTag.split("/")[1]

    # Get SHAs for both tags
    previousSHA = getSHAFromTag(previousTag)
    currentSHA = getSHAFromTag(tag)

    # Get all commit SHAs between tags
    cmd = ['git', 'rev-list', '--ancestry-path', previousSHA + '..' + currentSHA]
    proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
    # Remove first commit from this list as it will always be a version bump commit
    commits = proc.communicate()[0].decode("utf-8").split()[1:]

    # Write commit messages to release notes
    f.write("## Changes\n\n")
    for commit in commits[::-1]:
      f.write("- {0}\n".format(getCommitMessage(commit)))
    f.write("\n")
    f.write("**Full changelog:** [{0}...{1}](https://github.com/iTwin/itwinjs-core/compare/{2}...{3})\n".format(previousVer, currentVer, previousTag, tag))
    f.close()

  else:
    # If major/minor release, grab corresponding markdown from ./docs/changehistory
    fileName = "docs/changehistory/{0}.md".format(currentVer)
    if not os.path.exists(fileName):
      print("changehistory {0} could not be found.. exiting".format(currentVer))
      return
    replace_image_links(fileName)
    convert_markdown_headings_to_html(fileName)

  # Create GitHub release using the markdown file
  print("Publishing GitHub release...")
  cmd = ['gh', 'release', 'create', tag, '-F', './' + fileName, '-t', '"v{0}"'.format(currentVer)]
  proc = subprocess.Popen(" ".join(cmd), stdin = subprocess.PIPE, stdout = subprocess.PIPE, shell=True)
  proc.wait()

# Validate arguments
if len(sys.argv) != 2:
  sys.exit("Invalid number of arguments to script provided.\nExpected: 1\nReceived: {0}".format(len(sys.argv) - 1))

releaseTag = sys.argv[1]
print("Creating release for " + releaseTag)
createRelease(releaseTag)
