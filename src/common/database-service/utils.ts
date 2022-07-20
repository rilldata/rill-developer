import type { BasicMeasureDefinition } from "$common/data-modeler-state-service/entity-state-service/MeasureDefinitionStateService";
import { getFallbackMeasureName } from "$common/data-modeler-state-service/entity-state-service/MeasureDefinitionStateService";
import type { TimeSeriesTimeRange } from "$common/database-service/DatabaseTimeSeriesActions";
import type { ActiveValues } from "$lib/redux-store/explore/explore-slice";

export function getFilterFromFilters(filters: ActiveValues): string {
  return Object.keys(filters)
    .map((field) => {
      return (
        "(" +
        filters[field]
          .map(([value, filterType]) =>
            filterType ? `"${field}" = '${value}'` : `"${field}" != '${value}'`
          )
          .join(" OR ") +
        ")"
      );
    })
    .join(" AND ");
}

/** Sets the sqlName to a fallback measure name, if sqlName is not defined */
export function normaliseMeasures(measures: Array<BasicMeasureDefinition>) {
  if (!measures) return [{ expression: "count(*)", id: "", sqlName: "count" }];
  measures.forEach((measure, idx) => {
    if (!measure.sqlName) {
      measure.sqlName = getFallbackMeasureName(idx);
    }
  });
  return measures;
}

export function getExpressionColumnsFromMeasures(
  measures: Array<BasicMeasureDefinition>
): string {
  return measures
    .map((measure) => `${measure.expression} as ${measure.sqlName}`)
    .join(", ");
}

export function getCoalesceStatementsMeasures(
  measures: Array<BasicMeasureDefinition>
): string {
  return measures
    .map(
      (measure) =>
        `COALESCE(series.${measure.sqlName}, 0) as ${measure.sqlName}`
    )
    .join(", ");
}

export function getWhereClauseFromFilters(
  filters: ActiveValues,
  timestampColumn: string,
  timeRange: TimeSeriesTimeRange,
  prefix: string
) {
  const whereClauses = [];
  if (filters && Object.keys(filters).length) {
    whereClauses.push(getFilterFromFilters(filters));
  }
  if (timeRange?.start || timeRange?.end) {
    whereClauses.push(getFilterFromTimeRange(timestampColumn, timeRange));
  }
  return whereClauses.length ? `${prefix} ${whereClauses.join(" AND ")}` : "";
}

export function getFilterFromTimeRange(
  timestampColumn: string,
  timeRange: TimeSeriesTimeRange
): string {
  const timeRangeFilters = new Array<string>();
  timeRange = normaliseTimeRange(timeRange);
  if (timeRange.start) {
    timeRangeFilters.push(
      `"${timestampColumn}" >= TIMESTAMP '${timeRange.start}'`
    );
  }
  if (timeRange.end) {
    timeRangeFilters.push(
      `"${timestampColumn}" <= TIMESTAMP '${timeRange.end}'`
    );
  }
  return timeRangeFilters.join(" AND ");
}

function normaliseTimeRange(timeRange: TimeSeriesTimeRange) {
  const returnTimeRange: TimeSeriesTimeRange = {
    ...(timeRange.interval ? { interval: timeRange.interval } : {}),
  };
  if (timeRange.start) {
    const startDate = new Date(timeRange.start);
    if (!Number.isNaN(startDate.getTime())) {
      returnTimeRange.start = startDate.toISOString();
    }
  }
  if (timeRange.end) {
    const endDate = new Date(timeRange.end);
    if (!Number.isNaN(endDate.getTime())) {
      returnTimeRange.end = endDate.toISOString();
    }
  }
  return returnTimeRange;
}
