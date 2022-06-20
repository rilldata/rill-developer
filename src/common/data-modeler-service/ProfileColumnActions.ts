import {
  EntityType,
  StateType,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";
import type { DataProfileStateActionArg } from "$common/data-modeler-state-service/entity-state-service/DataProfileEntity";
import { DataModelerActions } from "$common/data-modeler-service/DataModelerActions";
import {
  BOOLEANS,
  CATEGORICALS,
  NUMERICS,
  TIMESTAMPS,
} from "$lib/duckdb-data-types";
import type { ProfileColumn } from "$lib/types";
import { DatabaseActionQueuePriority } from "$common/priority-action-queue/DatabaseActionQueuePriority";
import { COLUMN_PROFILE_CONFIG } from "$lib/application-config";

const ColumnProfilePriorityMap = {
  [EntityType.Source]: DatabaseActionQueuePriority.SourceProfile,
  [EntityType.Model]: DatabaseActionQueuePriority.ActiveModelProfile,
};

export class ProfileColumnActions extends DataModelerActions {
  @DataModelerActions.DerivedAction()
  public async collectProfileColumns(
    { stateService }: DataProfileStateActionArg,
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    const persistentEntity = this.dataModelerStateService.getEntityById(
      entityType,
      StateType.Persistent,
      entityId
    );
    const entity = stateService.getById(entityId);
    if (!entity) {
      console.error(
        `Entity not found. entityType=${entityType} entityId=${entityId}`
      );
      return;
    }
    try {
      await Promise.all(
        entity.profile.map((column) =>
          this.collectColumnInfo(
            entityType,
            entityId,
            persistentEntity.sourceName,
            column
          )
        )
      );
    } catch (err) {
      // continue regardless of error
    }
  }

  private async collectColumnInfo(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    const promises = [];
    if (CATEGORICALS.has(column.type) || BOOLEANS.has(column.type)) {
      promises.push(
        this.collectTopKAndCardinality(entityType, entityId, sourceName, column)
      );
    } else {
      if (NUMERICS.has(column.type)) {
        promises.push(
          this.collectNumericHistogram(entityType, entityId, sourceName, column)
        );
      }
      if (TIMESTAMPS.has(column.type)) {
        promises.push(
          this.collectTimeRange(entityType, entityId, sourceName, column)
        );
        promises.push(
          this.collectSmallestTimegrainEstimate(
            entityType,
            entityId,
            sourceName,
            column
          )
        );
        promises.push(
          this.collectTimestampRollup(
            entityType,
            entityId,
            sourceName,
            column,
            // use the medium width for the spark line
            COLUMN_PROFILE_CONFIG.summaryVizWidth.medium,
            undefined
          )
        );
      } else {
        promises.push(
          this.collectDescriptiveStatistics(
            entityType,
            entityId,
            sourceName,
            column
          )
        );
      }
    }
    promises.push(
      this.collectNullCount(entityType, entityId, sourceName, column)
    );
    await Promise.all(promises);
  }

  private async collectTopKAndCardinality(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "getTopKAndCardinality",
        [sourceName, column.name]
      ),
    ]);
  }

  private async collectSmallestTimegrainEstimate(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "estimateSmallestTimeGrain",
        [sourceName, column.name]
      ),
    ]);
  }

  private async collectTimestampRollup(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn,
    pixels: number = undefined,
    sampleSize: number = undefined
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },

        "estimateTimestampRollup",
        [sourceName, column.name, pixels, sampleSize]
      ),
    ]);
  }

  private async collectNumericHistogram(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "getNumericHistogram",
        [sourceName, column.name, column.type]
      ),
    ]);
  }

  private async collectTimeRange(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "getTimeRange",
        [sourceName, column.name]
      ),
    ]);
  }

  private async collectDescriptiveStatistics(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateColumnSummary", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "getDescriptiveStatistics",
        [sourceName, column.name]
      ),
    ]);
  }

  private async collectNullCount(
    entityType: EntityType,
    entityId: string,
    sourceName: string,
    column: ProfileColumn
  ): Promise<void> {
    this.dataModelerStateService.dispatch("updateNullCount", [
      entityType,
      entityId,
      column.name,
      await this.databaseActionQueue.enqueue(
        { id: entityId, priority: ColumnProfilePriorityMap[entityType] },
        "getNullCount",
        [sourceName, column.name]
      ),
    ]);
  }
}
