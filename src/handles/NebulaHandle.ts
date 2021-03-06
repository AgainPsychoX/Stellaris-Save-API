import StellarisSave from "@/StellarisSave";
import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import { CoordsHandle } from "./CoordsHandle";
import { SystemHandle } from "./SystemHandle";

export class NebulaHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
	}

	get name() {
		return stripSidesByCharacter(this.$('name')._ as string);
	}
	set name(value: string) {
		this.$('name')._ = `"${value}"`;
	}

	get coords() {
		return new CoordsHandle(this.$('coordinate')._ as ParadoxDataObject);
	}
	set coords(value: CoordsHandle) {
		this.$('coordinate')._ = value._;
	}

	hasSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		const entry = this.$$('galactic_object').find(p => p.value === id);
		return !!entry;
	}
	addSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		const entry = this.$$('galactic_object').find(p => p.value === id);
		if (entry) {
			// Already inside
			return;
		}
		(this._ as ParadoxDataObject).push(['galactic_object', id]);
		// TODO: add nebula visuals (ambient objects)
	}
	removeSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		const entryIndex = (this._ as ParadoxDataObject).findIndex(e => e[0] === 'galactic_object' && e[1] == id);
		if (entryIndex === -1) {
			// Already outside
			return;
		}
		(this._ as ParadoxDataObject).splice(entryIndex, 1);
		// TODO: remove nebula visuals (ambient objects)
	}

	get systemIds(): ReadonlyArray<number> {
		return this.$$('galactic_object').map(h => h.value as number);
	}
	get systems(): ReadonlyArray<SystemHandle> {
		return this.systemIds.map(id => this._save.getSystemById(id));
	}
}

export default NebulaHandle;
