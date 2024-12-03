import PointQueries from "../PointQueries";

/**
 * A snapshot of a value, recorded of a given expression at a given point.
 */
export default class RecordedValue {
  constructor(
    public readonly expression: string,
    public readonly pointQueries: PointQueries
  ) {}

  // TODO: Previews
}
