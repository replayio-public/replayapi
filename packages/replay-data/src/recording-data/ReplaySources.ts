import SourceParser from "@replay/source-parser/src/SourceParser";
import { Location, MappedLocation, SourceId } from "@replayio/protocol";
import { assert } from "protocol/utils";
import { Source, streamingSourceContentsCache } from "replay-next/src/suspense/SourcesCache";
import { getPreferredSourceId } from "replay-next/src/utils/sources";

import ReplaySession from "./ReplaySession";

export default class ReplaySources {
  readonly sourcesById: Map<SourceId, Source>;

  constructor(
    public readonly session: ReplaySession,
    public readonly sources: Source[]
  ) {
    this.sourcesById = new Map(sources.map(s => [s.id, s]));
  }
  
  getSource(sourceId: SourceId): Source | undefined {
    return this.sourcesById.get(sourceId);
  }

  /**
   * @returns The mapped source location, if available. Else the best unmapped.
   */
  getBestLocation(locations: MappedLocation): Location {
    const sourceId = getPreferredSourceId(
      this.sourcesById,
      locations.map(l => l.sourceId)
    );
    const preferredLocation = locations.find(l => l.sourceId == sourceId);
    assert(preferredLocation, "[getBestLocation] sourceId lookup bug: " + sourceId);
    return preferredLocation;
  }

  async parseContents(sourceId: SourceId): Promise<SourceParser> {
    const source = this.getSource(sourceId);
    const result = await streamingSourceContentsCache.readAsync(this.session, sourceId);
    assert(result.value, "[readContents] sources don't exist: " + sourceId);

    const { value: contents } = result;
    const { contentType } = result.data || {};
    const url = source?.url;
    assert(url, "[readContents] source has no url: " + sourceId);

    const parser = new SourceParser(url, contentType);
    parser.parse(contents);
    return parser;
  }
}
