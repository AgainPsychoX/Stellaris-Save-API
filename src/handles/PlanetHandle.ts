import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject } from "@/utils/paradox";
import { CoordsHandle } from "./CoordsHandle";

export class PlanetHandle extends ParadoxDataEntryHandle {
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

	get coords() {
		return new CoordsHandle(this.$('coordinate')._ as ParadoxDataObject);
	}
	set coords(value: CoordsHandle) {
		this.$('coordinate')._ = value._;
	}

	get class() {
		return this.$('planet_class')._ as string;
	}
	set class(value: string) {
		this.$('planet_class')._ = value;;
	}

	get size() {
		return this.$('planet_size')._ as number;
	}
	set size(value: number) {
		this.$('planet_size')._ = value;
	}

	get orbit() {
		return this.$('orbit')._ as number;
	}
	set orbit(value: number) {
		this.$('orbit')._ = value;
	}
}

export default PlanetHandle;
