import { ParadoxDataEntry, ParadoxDataEntryHandle } from "@/utils/paradox";

export class LeaderHandle extends ParadoxDataEntryHandle {
	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle
	) {
		super(entry instanceof ParadoxDataEntryHandle ? entry._entry : entry);
	}

	get id() {
		return this.key as number;
	}

	get name() {
		return this.$('name')._ as string;
	}
	set name(value: string) {
		this.$('name')._ = value;
	}
}

export default LeaderHandle;
