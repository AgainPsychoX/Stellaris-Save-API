import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import PlanetHandle from "./PlanetHandle";
import ShipDesignsCollectionHandle from "./ShipDesignsCollectionHandle";
import LeaderHandle from "./LeaderHandle";
import { MyError } from "@/utils/common";
import SectorHandle from "./SectorHandle";

export class CountryHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry instanceof ParadoxDataEntryHandle ? entry._entry : entry);
		this._save = save;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Base stuff

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
		this.$('type')._ = `"${value}""`;
	}

	get personality() {
		return stripSidesByCharacter(this.$('personality')._ as string);
	}
	set personality(value: string) {
		this.$('personality')._ = `"${value}""`;
	}

	// TODO: flags

	////////////////////////////////////////////////////////////////////////////////
	// Build

	get ethos() {
		const ethos = this.$('ethos')._ as ParadoxDataObject || [];
		return ethos.map(e => stripSidesByCharacter(e[1] as string));
	}
	set ethos(value: string[]) {
		this.$('ethos')._ = value.map(v => ['ethic', `"${v}"`]);
	}

	get governmentType() {
		const gov = this.$('government');
		if (gov._ === undefined) return undefined;
		return stripSidesByCharacter(gov.$('type')._ as string);
	}
	set governmentType(value: string | undefined) {
		this.$('government').$('type')._ = `"${value}"`;
	}

	get civics() {
		const gov = this.$('government');
		if (gov._ === undefined) return [];
		const civics = gov.$('civics')._ as ParadoxDataObject || [];
		return civics.map(e => stripSidesByCharacter(e[1] as string));
	}
	set civics(value: string[]) {
		this.$('government').$('civics')._ = value.map(v => [null, `"${v}"`]);
	}

	get origin() {
		const gov = this.$('government');
		if (gov._ === undefined) return undefined;
		return stripSidesByCharacter(gov.$('origin')._ as string);
	}
	set origin(value: string | undefined) {
		this.$('government').$('origin')._ = `"${value}"`;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get capitalId() {
		return this.$('capital')._ as number;
	}
	getCapital() {
		return this._save.getPlanetById(this.capitalId);
	}
	setCapital(idOrHandle: number | PlanetHandle | undefined) {
		this.$('capital')._ = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
	}

	get ownedPlanets() {
		const entries = this.$('owned_planets')._ as ParadoxDataObject | undefined;
		if (!entries) return [];
		return entries
			.map(e => this._save.findPlanetById(e[1] as number))
			.filter(p => !!p) as PlanetHandle[]
		;
	}
	set ownedPlanets(idsOrHandles: (number | PlanetHandle)[]) {
		this.$('owned_planets')._ = idsOrHandles
			.map(idOrHandle => [null, typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle])
		;
	}

	get startingSystemId() {
		return this.$('starting_system')._ as number;
	}
	get startingSystem() {
		return this._save.findSystemById(this.startingSystemId);
	}

	// TODO: species (founder_species_ref & built_species_ref)

	get rulerId() {
		return this.$('ruler')._ as number | undefined;
	}
	get ruler() {
		const id = this.rulerId;
		return (id ? this._save.getLeaderById(id) : undefined);
	}
	set ruler(idOrHandle: number | LeaderHandle | undefined) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		if (id === undefined || this.ownedLeadersIds.includes(id)) {
			this.$('ruler')._ = id;
		}
		else {
			throw new MyError('relations/assign-not-owned-leader', `Trying to assign not owned leader ${id} as ruler to the country ${this.id}`);
		}
	}

	getScientistLeaderId(which: 'physics' | 'society' | 'engineering') {
		return this.$('tech_status').$('leaders').$(which)._ as number;
	}
	getScientistLeader(which: 'physics' | 'society' | 'engineering') {
		const id = this.getScientistLeaderId(which);
		return (id ? this._save.getLeaderById(id) : undefined);
	}
	setScientistLeader(which: 'physics' | 'society' | 'engineering', idOrHandle: number | LeaderHandle | undefined) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		if (id === undefined || this.ownedLeadersIds.includes(id)) {
			this.$('tech_status').$('leaders').$(which)._ = id;
			if (idOrHandle !== undefined) {
				// const handle = idOrHandle instanceof LeaderHandle ? idOrHandle : this._save.getLeaderById(idOrHandle); 
				// TODO: assign
			}
			
		}
		else {
			throw new MyError('relations/assign-not-owned-leader', `Trying to assign not owned leader ${id} as ${which} science leader to the country ${this.id}`);
		}
	}

	get ownedLeadersIds(): ReadonlyArray<number> {
		return this.$('owned_leaders').$$().map(e => e._ as number);
	}
	get ownedLeaders(): ReadonlyArray<LeaderHandle> {
		return this.ownedLeadersIds.map(id => this._save.getLeaderById(id))
	}

	addLeader(idOrHandle: number | LeaderHandle) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		if (!this.ownedLeadersIds.includes(id)) {
			this.$('owned_leaders').valueAsObject().push([null, id]);
		}
		const handle = idOrHandle instanceof LeaderHandle ? idOrHandle : this._save.getLeaderById(idOrHandle);
		if (handle.countryId !== this.id) {
			handle.country = this.id;
		}
		// TODO: remove assigned leaders from clean up list?
	}

	removeLeader(idOrHandle: number | LeaderHandle) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('owned_leaders').valueAsObject();
		const index = array.findIndex(e => e[1] === id);
		if (index !== -1) {
			array.splice(index, 1);
			// const handle = idOrHandle instanceof LeaderHandle ? idOrHandle : this._save.getLeaderById(idOrHandle);
			// handle.country = undefined;
			// TODO: enlist unassigned leaders to clean up list?
			if (this.rulerId == id) {
				this.ruler = undefined;
			}
			for (const which of ['physics', 'society', 'engineering'] as const) {
				if (this.getScientistLeaderId(which) === id) {
					this.setScientistLeader(which, undefined);
				}
			}
			// TODO: unassign from planets/sectors and ships
		}
	}

	// TODO: move leader ownership
	// TODO: add leader
	// TODO: unassigned lists that are cleaned up on save?

	// TODO: fleets
	// TODO: armies
	// TODO: economy

	get sectorIds(): ReadonlyArray<number> {
		return this.$('sectors').$('owned').$$().map(e => e._ as number);
	}
	get sectors(): ReadonlyArray<SectorHandle> {
		return this.sectorIds.map(id => this._save.getSectorById(id));
	}

	addSector(idOrHandle: number | SectorHandle) {
		const id = idOrHandle instanceof SectorHandle ? idOrHandle.id : idOrHandle;
		if (this.sectorIds.includes(id)) {
			// Already inside
			return;
		}
		const array = this.$('sector').$('owned').valueAsObject();
		array.push([null, id]);
		const handle = idOrHandle instanceof SectorHandle ? idOrHandle : this._save.getSectorById(idOrHandle);
		handle.setOwner(this);
		// TODO: what about previous owner?
	}
	removeSector(idOrHandle: number | SectorHandle) {
		const id = idOrHandle instanceof SectorHandle ? idOrHandle.id : idOrHandle;
		if (!this.sectorIds.includes(id)) {
			// Already outside
			return;
		}
		const array = this.$('sector').$('owned').valueAsObject();
		const index = array.findIndex(e => e[1] === id);
		if (index !== -1) {
			array.splice(index, 1);
		}
		// const handle = idOrHandle instanceof SectorHandle ? idOrHandle : this._save.getSectorById(idOrHandle);
		// handle.setOwner(undefined);
		// TODO: what about new owner?
	}

	get shipDesigns() {
		return new ShipDesignsCollectionHandle(this.$('ship_design_collection'), this._save);
	}

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Removes country and relations (i.e. owned colonies, fleets, pops, etc.).
	 */
	remove(settings: {
		// removeSpecies?: boolean;
	} = {}) {
		settings = Object.assign({
			// removeSpecies: false,
		}, settings);

		// Remove leaders. Don't have to unassign them from sector and ships,
		// as we remove the sector and ships as well.
		for (const leader of this._save.leaders) {
			if (leader.countryId === this.id) {
				leader.value = undefined;
			}
		}
		this._save.leaders = this._save.leaders.filter(h => h.value == undefined);

		// TODO: factions

		// Remove fleets
		const systemsVisited: number[] = [];
		for (const fleet of this._save.fleets) {
			if (fleet.ownerId === this.id) {
				for (const ship of fleet.ships) {
					ship.value = undefined;
				}
				fleet.unassignOrbit();
				fleet.value = undefined;
				if (fleet.isStation) {
					const systemId = fleet.coords.origin;
					if (!systemsVisited.includes(systemId)) {
						systemsVisited.push(systemId);
						const system = this._save.getSystemById(systemId);
						system.setStarbase(undefined);
					}
				}
			}
		}

		// Ship designs will not be removed, just in case?

		// Remove armies
		for (const army of this._save.armies) {
			if (army.ownerId === this.id) {
				army.value = undefined;
			}
		}

		// Remove controller flag, colonies, local starbase
		for (const planet of this._save.planets) {
			if (planet.ownerId === this.id) {
				planet.decolonize();
			}
			if (planet.controllerId === this.id) {
				planet.controller = undefined;
			}
		}

		// Remove sectors
		for (const sector of this._save.sectors) {
			if (sector.ownerId === this.id) {
				sector.value = undefined;
			}
		}

		this.value = undefined;
	}
}

export default CountryHandle;
