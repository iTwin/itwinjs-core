import os
import argparse
import shutil
import glob

def getParentDirectory(path, levels = 1):
  for _ in range(levels):
    path = os.path.dirname(path)
  return path

parser = argparse.ArgumentParser()
parser.add_argument(
  "--output", help="Output path where xml reports will be copied")
args = parser.parse_args()
workDir = os.getcwd()

listOfFiles = []

projDir = getParentDirectory(workDir, 3)
for path in glob.iglob((projDir + "/*/*/lib/**/cobertura-coverage.xml"), recursive=True):
  listOfFiles.append(path)

outputDir = os.path.join(args.output, "coverageXMLs")
if not os.path.exists(outputDir):
  os.makedirs(outputDir)

start = "imodeljs"
end = "lib"
for file in listOfFiles:
  filePathParts = file.split(os.sep)
  coveragePath = os.path.join(*filePathParts[filePathParts.index((start))+1:filePathParts.index(end)])
  destFilePath = os.path.join(outputDir, coveragePath)

  if not os.path.exists(destFilePath):
    os.makedirs(destFilePath)

  shutil.copy(file, destFilePath)

