import StaticScope from "@replayio/source-parser/src/bindings/StaticScope";
import { NamedValue } from "@replayio/protocol";

import PointQueries from "../PointQueries";

/**
 * Dynamic scope data recorded at a given point in a recording.
 */
export default class DynamicScope {
  constructor(
    public readonly pointQueries: PointQueries,
    public readonly parent: DynamicScope | null,
    public readonly staticScope: StaticScope,
    public readonly dynamicBindings: NamedValue[]
  ) {}
}
