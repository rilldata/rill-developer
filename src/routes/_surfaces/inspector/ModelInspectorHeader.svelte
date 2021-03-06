<script lang="ts">
  import { FileExportType } from "$common/data-modeler-service/ModelActions";
  import { ActionStatus } from "$common/data-modeler-service/response/ActionResponse";
  import type { DerivedModelEntity } from "$common/data-modeler-state-service/entity-state-service/DerivedModelEntityService";
  import type { DerivedTableEntity } from "$common/data-modeler-state-service/entity-state-service/DerivedTableEntityService";
  import type { PersistentModelEntity } from "$common/data-modeler-state-service/entity-state-service/PersistentModelEntityService";
  import { COLUMN_PROFILE_CONFIG } from "$lib/application-config";
  import {
    ApplicationStore,
    config as appConfig,
    dataModelerService,
  } from "$lib/application-state-stores/application-store";
  import type {
    DerivedModelStore,
    PersistentModelStore,
  } from "$lib/application-state-stores/model-stores";
  import type {
    DerivedTableStore,
    PersistentTableStore,
  } from "$lib/application-state-stores/table-stores";
  import Button from "$lib/components/Button.svelte";
  import Export from "$lib/components/icons/Export.svelte";
  import Metrics from "$lib/components/icons/Metrics.svelte";
  import Menu from "$lib/components/menu/Menu.svelte";
  import MenuItem from "$lib/components/menu/MenuItem.svelte";
  import ExportError from "$lib/components/modal/ExportError.svelte";
  import FloatingElement from "$lib/components/tooltip/FloatingElement.svelte";
  import Tooltip from "$lib/components/tooltip/Tooltip.svelte";
  import TooltipContent from "$lib/components/tooltip/TooltipContent.svelte";
  import { TIMESTAMPS } from "$lib/duckdb-data-types";
  import { createMetricsDefsApi } from "$lib/redux-store/metrics-definition/metrics-definition-apis";
  import { store } from "$lib/redux-store/store-root";
  import {
    formatBigNumberPercentage,
    formatInteger,
  } from "$lib/util/formatters";
  import { onClickOutside } from "$lib/util/on-click-outside";
  import { getContext, tick } from "svelte";
  import { sineOut as easing } from "svelte/easing";
  import { tweened } from "svelte/motion";

  export let containerWidth = 0;

  const persistentTableStore = getContext(
    "rill:app:persistent-table-store"
  ) as PersistentTableStore;
  const derivedTableStore = getContext(
    "rill:app:derived-table-store"
  ) as DerivedTableStore;
  const persistentModelStore = getContext(
    "rill:app:persistent-model-store"
  ) as PersistentModelStore;
  const derivedModelStore = getContext(
    "rill:app:derived-model-store"
  ) as DerivedModelStore;

  const appStore = getContext("rill:app:store") as ApplicationStore;

  let contextMenu;
  let contextMenuOpen = false;
  let menuX;
  let menuY;
  let clickOutsideListener;
  $: if (!contextMenuOpen && clickOutsideListener) {
    clickOutsideListener();
    clickOutsideListener = undefined;
  }

  const onExport = async (fileType: FileExportType) => {
    let extension = ".csv";
    if (fileType === FileExportType.Parquet) {
      extension = ".parquet";
    }
    const exportFilename = currentModel.name.replace(".sql", extension);

    const exportResp = await dataModelerService.dispatch(fileType, [
      currentModel.id,
      exportFilename,
    ]);

    if (exportResp.status === ActionStatus.Success) {
      window.open(
        `${
          appConfig.server.serverUrl
        }/api/file/export?fileName=${encodeURIComponent(exportFilename)}`
      );
    } else if (exportResp.status === ActionStatus.Failure) {
      exportErrorMessage = `Failed to export.\n${exportResp.messages
        .map((message) => message.message)
        .join("\n")}`;
      showExportErrorModal = true;
    }
  };

  const detectTimestampColumn = (model: DerivedModelEntity) => {
    if (!model) return false;
    const profile = model.profile;
    const timestampColumn = profile?.find((column) => {
      return TIMESTAMPS.has(column.type);
    });
    return !!timestampColumn;
  };

  $: hasTimestampColumn = detectTimestampColumn(currentDerivedModel);

  const handleCreateMetric = () => {
    // A side effect of the createMetricsDefsApi is we switch active assets to
    // the newly created metrics definition. So, this'll bring us to the
    // MetricsDefinition page. (The logic for this is contained in the
    // not-pictured async thunk.)
    store.dispatch(
      createMetricsDefsApi({
        sourceModelId: currentModel.id,
      })
    );
  };

  let rollup;
  let tables;
  // get source tables?
  let sourceTableReferences;

  let showExportErrorModal: boolean;
  let exportErrorMessage: string;

  // interface tweens for the  big numbers
  let bigRollupNumber = tweened(0, { duration: 700, easing });
  let outputRowCardinality = tweened(0, { duration: 250, easing });

  /** Select the explicit ID to prevent unneeded reactive updates in currentModel */
  $: activeEntityID = $appStore?.activeEntity?.id;

  let currentModel: PersistentModelEntity;
  $: currentModel =
    activeEntityID && $persistentModelStore?.entities
      ? $persistentModelStore.entities.find((q) => q.id === activeEntityID)
      : undefined;
  let currentDerivedModel: DerivedModelEntity;
  $: currentDerivedModel =
    activeEntityID && $derivedModelStore?.entities
      ? $derivedModelStore.entities.find((q) => q.id === activeEntityID)
      : undefined;
  // get source table references.
  $: if (currentDerivedModel?.sources) {
    sourceTableReferences = currentDerivedModel?.sources;
  }

  // map and filter these source tables.
  $: if (sourceTableReferences?.length) {
    tables = sourceTableReferences
      .map((sourceTableReference) => {
        const table = $persistentTableStore.entities.find(
          (t) => sourceTableReference.name === t.tableName
        );
        if (!table) return undefined;
        return $derivedTableStore.entities.find(
          (derivedTable) => derivedTable.id === table.id
        );
      })
      .filter((t) => !!t);
  } else {
    tables = [];
  }

  // compute rollup factor
  $: outputRowCardinalityValue = currentDerivedModel?.cardinality;
  $: if (
    outputRowCardinalityValue !== 0 &&
    outputRowCardinalityValue !== undefined
  ) {
    outputRowCardinality.set(outputRowCardinalityValue);
  }
  $: inputRowCardinalityValue = tables?.length
    ? tables.reduce((acc, v) => acc + v.cardinality, 0)
    : 0;
  $: if (
    inputRowCardinalityValue !== undefined &&
    outputRowCardinalityValue !== undefined
  ) {
    rollup = outputRowCardinalityValue / inputRowCardinalityValue;
  }

  function validRollup(number) {
    return rollup !== Infinity && rollup !== -Infinity && !isNaN(number);
  }

  $: if (rollup !== undefined && !isNaN(rollup)) bigRollupNumber.set(rollup);

  // compute column delta
  $: inputColumnNum = tables?.length
    ? tables.reduce((acc, v: DerivedTableEntity) => acc + v.profile.length, 0)
    : 0;
  $: outputColumnNum = currentDerivedModel?.profile?.length;
  $: columnDelta = outputColumnNum - inputColumnNum;
</script>

{#if currentModel && currentModel.query.trim().length && tables}
  <div
    style:height="var(--header-height)"
    class:text-gray-300={currentDerivedModel?.error}
    class="px-4 flex flex-row items-center gap-x-2 justify-end"
  >
    {#if !currentDerivedModel?.error && rollup !== undefined && rollup !== Infinity && rollup !== -Infinity}
      <Tooltip
        location="left"
        alignment="middle"
        distance={16}
        suppress={contextMenuOpen}
      >
        <Button
          type="secondary"
          on:click={async (event) => {
            contextMenuOpen = !contextMenuOpen;
            menuX = event.detail.x;
            menuY = event.detail.y;
            if (!clickOutsideListener) {
              await tick();
              clickOutsideListener = onClickOutside(() => {
                contextMenuOpen = false;
              }, contextMenu);
            }
          }}
        >
          Export Results
          <Export size="16px" />
        </Button>
        <TooltipContent slot="tooltip-content">
          Export this model as a dataset
        </TooltipContent>
      </Tooltip>
      <Tooltip location="bottom" alignment="right" distance={16}>
        <Button
          type="primary"
          disabled={!hasTimestampColumn}
          on:click={handleCreateMetric}
          >Create Metrics<Metrics size="16px" /></Button
        >
        <TooltipContent slot="tooltip-content">
          {#if hasTimestampColumn}
            Create metrics based on your model
          {:else}
            Add a timestamp column to your model in order to create a metric
          {/if}
        </TooltipContent>
      </Tooltip>
    {/if}
  </div>
  <div class="grow text-right px-4 pb-4 pt-2" style:height="56px">
    {#if !currentDerivedModel?.error && rollup !== undefined && rollup !== Infinity && rollup !== -Infinity}
      <!-- top row: row analysis -->
      <div
        class="flex flex-row items-center justify-between"
        class:text-gray-300={currentDerivedModel?.error}
      >
        <div class="italic text-gray-500">
          {#if !currentDerivedModel?.error && rollup !== undefined && rollup !== Infinity && rollup !== -Infinity}
            <Tooltip location="left" alignment="center" distance={8}>
              <div>
                {#if validRollup(rollup)}
                  {#if isNaN(rollup)}
                    ~
                  {:else if rollup === 0}
                    <!-- show no additional text. -->
                    resultset is empty
                  {:else if rollup !== 1}
                    {formatBigNumberPercentage(
                      rollup < 0.0005 ? rollup : $bigRollupNumber || 0
                    )}
                    of source rows
                  {:else}no change in row {#if containerWidth > COLUMN_PROFILE_CONFIG.hideRight}count{:else}ct.{/if}
                  {/if}
                {:else if rollup === Infinity}
                  &nbsp; {formatInteger(outputRowCardinalityValue)} row{#if outputRowCardinalityValue !== 1}s{/if}
                  selected
                {/if}
              </div>
              <TooltipContent slot="tooltip-content">
                <div class="py-1 font-bold">the rollup percentage</div>
                <div style:width="240px" class="pb-1">
                  the ratio of resultset rows to source rows, as a percentage
                </div>
              </TooltipContent>
            </Tooltip>
          {/if}
        </div>
        <div class="text-gray-800 font-bold">
          {#if inputRowCardinalityValue > 0}
            {formatInteger(~~outputRowCardinalityValue)} row{#if outputRowCardinalityValue !== 1}s{/if}
          {:else if inputRowCardinalityValue === 0}
            no rows selected
          {:else}
            &nbsp;
          {/if}
        </div>
      </div>
      <!-- bottom row: column analysis -->
      <div class="flex flex-row justify-between">
        <div class="italic text-gray-500">
          {#if columnDelta > 0}
            {formatInteger(columnDelta)} column{#if columnDelta !== 1}s{/if} added
          {:else if columnDelta < 0}
            {formatInteger(-columnDelta)} column{#if -columnDelta !== 1}s{/if} dropped
          {:else if columnDelta === 0}
            no change in column count
          {:else}
            &nbsp;
          {/if}
        </div>
        <div class="text-gray-800 font-bold">
          {currentDerivedModel?.profile?.length} columns
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if contextMenuOpen}
  <!-- place this above codemirror.-->
  <div bind:this={contextMenu}>
    <FloatingElement
      relationship="mouse"
      target={{ x: menuX, y: menuY }}
      location="left"
      alignment="start"
    >
      <Menu
        dark
        on:escape={() => {
          contextMenuOpen = false;
        }}
        on:item-select={() => {
          contextMenuOpen = false;
        }}
      >
        <MenuItem on:select={() => onExport(FileExportType.Parquet)}>
          Export as Parquet
        </MenuItem>
        <MenuItem on:select={() => onExport(FileExportType.CSV)}>
          Export as CSV
        </MenuItem>
      </Menu>
    </FloatingElement>
  </div>
  <ExportError bind:exportErrorMessage bind:showExportErrorModal />
{/if}
