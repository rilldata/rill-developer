import { Config } from "$common/utils/Config";

export class StateConfig extends Config<StateConfig> {
    @Config.ConfigField(true)
    public autoSync: boolean;

    @Config.ConfigField(500)
    public syncInterval: number
}
