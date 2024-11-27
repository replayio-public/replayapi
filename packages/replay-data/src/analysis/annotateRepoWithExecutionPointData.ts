/* Copyright 2020-2024 Record Replay Inc. */

// Entry point for annotating a repository with execution data.

import assert from "assert";
import fs from "fs";
import path from "path";

import { ExecutionPoint as ProtocolExecutionPoint } from "@replayio/protocol";

import { ExecutionDataAnalysisResult } from "./specs/execution-point";

export interface AnnotateExecutionDataSpec {
  // Repository directory to annotate.
  repository: string;
  /**
   * Results from the ExecutionData script.
   */
  results: ExecutionDataAnalysisResult;
}

// Get a name to use in annotations for a source URL.
function getURLName(url: string) {
  const urlInfo = new URL(url);
  const basename = path.basename(urlInfo.pathname);
  const match = /(.*?)\./.exec(basename);
  return match ? match[1] : basename;
}

// Get the file to use for a source URL.
function getFilePath(repository: string, url: string) {
  const urlInfo = new URL(url);
  const match = /.*?\/(.*)/.exec(urlInfo.pathname);
  assert(match, `Unexpected URL ${url}`);
  const filePath = path.join(repository, match[1]);
  assert(fs.existsSync(filePath), `File ${filePath} does not exist`);
  return filePath;
}

function countLeadingSpaces(str: string) {
  const leadingSpaces = /^ */.exec(str); // Match leading spaces
  return leadingSpaces ? leadingSpaces[0].length : 0;
}

export async function annotateExecutionData(spec: AnnotateExecutionDataSpec): Promise<void> {
  let { results } = spec;
  const { points } = results;

  // Write annotations to source files.
  const pointNames = new Map<ProtocolExecutionPoint, string>();
  const existingNames = new Set<string>();
  for (const { point, location } of points) {
    const baseName = `Repro:${getURLName(location.url)}`;
    assert(!existingNames.has(baseName), `Duplicate point name ${baseName}`);
    existingNames.add(baseName);
    pointNames.set(point, baseName);
  }

  for (const { point, location, entries } of points) {
    const name = pointNames.get(point);
    const annotationLines = [`Reproduction step ${name}:`];

    for (const { value, contents, associatedPoint } of entries) {
      const associatedName = associatedPoint ? pointNames.get(associatedPoint) : undefined;

      if (value) {
        let line = `${value} has contents ${contents}`;
        if (associatedName) {
          line += `, which is an object created at reproduction step ${associatedName}`;
        }
        annotationLines.push(line);
      } else if (associatedName) {
        annotationLines.push(`${contents} is at reproduction step ${associatedName}`);
      } else {
        // When there is no value there must be an associated point, but if we didn't get the
        // execution data for that point we don't bother with an annotation.
        assert(associatedPoint);
      }
    }

    // Reverse the lines as the loop below will add them in reverse order.
    annotationLines.reverse();

    const filePath = getFilePath(spec.repository, location.url);
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    let found = false;
    for (let i = location.line - 1; i < lines.length; i++) {
      if (lines[i].trim() == location.source) {
        found = true;
        const indent = " ".repeat(countLeadingSpaces(lines[i]));
        for (const line of annotationLines) {
          lines[i] = `${indent}// ${line}\n${lines[i]}`;
        }
        break;
      }
    }
    assert(found, `Line ${location.source} not found in ${filePath}`);
    fs.writeFileSync(filePath, lines.join("\n"));
  }
}
