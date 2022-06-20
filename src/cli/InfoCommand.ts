import { DataModelerCliCommand } from "$cli/DataModelerCliCommand";
import { Command } from "commander";
import type { DataModelerStateService } from "$common/data-modeler-state-service/DataModelerStateService";
import {
  EntityType,
  StateType,
} from "$common/data-modeler-state-service/entity-state-service/EntityStateService";

export class InfoCommand extends DataModelerCliCommand {
  public getCommand(): Command {
    return this.applyCommonSettings(
      new Command("info"),
      "Display information about project."
    ).action((opts, command: Command) => {
      const { project } = command.optsWithGlobals();
      return this.run({ projectPath: project });
    });
  }

  protected async sendActions(): Promise<void> {
    InfoCommand.displayProjectInfo(
      this.projectPath,
      this.dataModelerStateService
    );
  }

  public static displayProjectInfo(
    projectPath: string,
    dataModelerStateService: DataModelerStateService
  ) {
    console.log("*** Project Info ***");
    console.log(`Project Path: ${projectPath}`);

    this.displaySourcesInfo(dataModelerStateService);
    this.displayModelsInfo(dataModelerStateService);
  }

  private static displaySourcesInfo(
    dataModelerStateService: DataModelerStateService
  ) {
    const sourceState = dataModelerStateService
      .getEntityStateService(EntityType.Source, StateType.Persistent)
      .getCurrentState();
    if (!sourceState?.entities.length) return;

    console.log("Imported Sources:");
    sourceState.entities.forEach((source) =>
      console.log(`${source.sourceName} (${source.path})`)
    );
  }

  private static displayModelsInfo(
    dataModelerStateService: DataModelerStateService
  ) {
    const modelState = dataModelerStateService
      .getEntityStateService(EntityType.Model, StateType.Persistent)
      .getCurrentState();
    if (!modelState?.entities.length) return;

    console.log("Models:");
    modelState.entities.forEach(
      (model) => model.query && console.log(`${model.name}: ${model.query}`)
    );
  }
}
