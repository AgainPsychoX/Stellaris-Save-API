import StellarisSave from "@/StellarisSave";
import { MyError } from "@/utils/common";
import { ParadoxDataEntry, ParadoxDataEntryHandle, stripSidesByCharacter } from "@/utils/paradox";
import CountryHandle from "./CountryHandle";
import LeaderHandle from "./LeaderHandle";
import { SystemHandle } from "./SystemHandle";

export const UndefinedSectorId = 4294967295;

export class SectorHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
	}

	get id() {
		return this.key as number;
	}

	get name() {
		return stripSidesByCharacter(this.$('name')._ as string);
	}
	set name(value: string) {
		this.$('name')._ = `"${value}"`;
	}

	get type() {
		return stripSidesByCharacter(this.$('type')._ as string);
	}
	set type(value: string) {
		this.$('type')._ = `"${value}"`;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Systems

	get systemIds(): ReadonlyArray<number> {
		return this.$('systems').$$().map(e => e.value as number);
	}
	get systems(): ReadonlyArray<SystemHandle> {
		return this.systemIds.map(id => this._save.getSystemById(id));
	}

	hasSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		const entry = this.systemIds.includes(id);
		return !!entry;
	}
	addSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		if (this.hasSystem(id)) {
			// Already inside
			return;
		}
		this.$('systems').valueAsObject().push([null, id]);
	}
	removeSystem(idOrHandle: SystemHandle | number) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		const array = this.$('systems').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index === -1) {
			// Already outside
			return;
		}
		array.splice(index, 1);
	}
	
	////////////////////////////////////////////////////////////////////////////////

	get ownerId() {
		return this.$('owner')._ as number;
	}
	getOwner() {
		return this._save.getCountryById(this.ownerId);
	}
	setOwner(idOrHandle: number | CountryHandle) {
		const id = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;;
		this.$('owner')._ = id;
	}

	get governorId() {
		return this.$('governor')._ as number | undefined;
	}
	getGovernor() {
		const id = this.governorId;
		return (id ? this._save.getLeaderById(id) : undefined);
	}
	setGovernor(idOrHandle: number | LeaderHandle | undefined) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		this.$('governor')._ = id;
		if (id != undefined) {
			const handle = idOrHandle instanceof LeaderHandle ? idOrHandle : this._save.getLeaderById(id);
			if (!this.getOwner().ownedLeadersIds.includes(id)) {
				throw new MyError('sector/assign-not-owned-governor', `Trying to assign not owned leader ${id} as governor to sector ${this.id} of the country ${this.ownerId}`);
			}
			handle.unassign();
			// TODO: check leader type?
		}
	}

	remove() {
		for (const system of this.systems) {
			system.setSector(undefined);
		}
		this.getGovernor()?.unassign();
		// TODO: owner

		// Remove from gamestate structure
		{
			const entries = this._save.gamestate.$('sectors').valueAsObject();
			const index = entries.findIndex(e => e[0] == this.id);
			if (index !== -1) {
				entries.splice(index, 1);
			}
		}

		// Remove from save global handles list
		{
			const index = this._save.sectors.indexOf(this);
			if (index !== -1) {
				this._save.sectors.splice(index, 1);
			}
		}
	}
}

export default SectorHandle;
