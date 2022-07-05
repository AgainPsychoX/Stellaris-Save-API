import { $, ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";
import { MyError } from "@/utils/common";
import StellarisSave from "@/StellarisSave";
import PlanetHandle from "./PlanetHandle";
import ShipDesignsCollectionHandle from "./ShipDesignsCollectionHandle";
import LeaderHandle from "./LeaderHandle";
import SectorHandle from "./SectorHandle";
import FleetHandle from "./FleetHandle";
import FleetTemplateHandle from "./FleetTemplateHandle";
import SystemHandle from "./SystemHandle";

export const UndefinedCountry = 4294967295;

export class FleetOwnershipHandle extends ParadoxDataObjectHandle {
	_owner: CountryHandle;

	get _save() { 
		return this._owner._save;
	}

	constructor(
		object: ParadoxDataObject | ParadoxDataObjectHandle | ParadoxDataEntryHandle,
		owner: CountryHandle,
	) {
		super(object);
		this._owner = owner
	}

	get fleetId() {
		return this.$('fleet')._ as number;
	}
	get fleet() {
		return this._save.getFleetById(this.fleetId);
	}

	get ownerId() {
		return this._owner.id;
	}
	get owner() {
		return this._owner;
	}

	get previousOwnerId() {
		const value = this.$('previous_owner')._ as number | undefined;
		if (value == UndefinedCountry) return undefined;
		return value;
	}
	get previousOwner() {
		return this.previousOwnerId == undefined ? undefined : this._save.getCountryById(this.previousOwnerId);
	}

	// TODO: lease_period, debtor
}

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
		return stripSidesByCharacter(this.$('name').$('key')._ as string);
	}
	set name(value: string) {
		this.$('name').$('key')._ = `"${value}"`;
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

	get shipGraphicalCulture() {
		return stripSidesByCharacter(this.$('graphical_culture').value as string);
	}
	set shipGraphicalCulture(value: string) {
		this.$('graphical_culture').value = `"${value}"`;
	}

	get cityGraphicalCulture() {
		return stripSidesByCharacter(this.$('city_graphical_culture').value as string);
	}
	set cityGraphicalCulture(value: string) {
		this.$('city_graphical_culture').value = `"${value}"`;
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

	////////////////////////////////////////////////////////////////////////////////

	get visibleSystemsIds(): ReadonlyArray<number> {
		return this.$('terra_incognita').$('systems').valueAsObject().map(e => e[1] as number);
	}
	get visibleSystems(): ReadonlyArray<SystemHandle> {
		return this.visibleSystemsIds.map(id => this._save.getSystemById(id));
	}

	addSystemVisibility(idOrHandle: number | SystemHandle) {
		const id = idOrHandle instanceof SystemHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('terra_incognita').$('systems').valueAsObject();
		const index = array.findIndex(e => e[1] as number >= id); // keeping them sorted btw
		if (index === -1) {
			array.push([null, id]);		
		}
		else {
			if (array[index]?.[1] == id) return; // already in
			array.splice(index - 1, 0, [null, id]); // put before larger ID
		}
	}

	removeSystemVisibility(idOrHandle: number | SystemHandle) {
		const id = idOrHandle instanceof SystemHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('terra_incognita').$('systems').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index !== -1) {
			array.splice(index, 1);
		}
	}

	////////////////////////////////////////////////////////////////////////////////

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

	////////////////////////////////////////////////////////////////////////////////

	get fleetOwnerships(): ReadonlyArray<FleetOwnershipHandle> {
		return this.$('fleets_manager').$('owned_fleets').valueAsObject()
			.map(e => new FleetOwnershipHandle(e[1] as ParadoxDataObject, this));
	}
	get ownedFleetsIds(): ReadonlyArray<number> {
		return this.fleetOwnerships.map(h => h.fleetId);
	}
	get ownedFleets(): ReadonlyArray<FleetHandle> {
		return this.fleetOwnerships.map(h => h.fleet);
	}

	/**
	 * Registers fleet as owned by this country. 
	 * 
	 * Changes ownership of the fleet (and ships) to the country.
	 */
	registerOwnedFleet(idOrHandle: number | FleetHandle) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('fleets_manager').$('owned_fleets').valueAsObject();
		const index = array.findIndex(o => $(o[1]).$('fleet')._ == id);
		if (index === -1) {
			array.push([null, [
				['fleet', id],
				['ownership_status', 'normal'],
				// ['lease_period', 0],
				// ['debtor', UndefinedCountry],
				// ['previous_owner', UndefinedCountry],
			]]);
		}
		// TODO: update fleet owner cache
	}
	/**
	 * Unregisters fleet ownership. Ship will need have new owner assigned after.
	 */
	unregisterOwnedFleet(idOrHandle: number | FleetHandle) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		const handle = idOrHandle instanceof FleetHandle ? idOrHandle : this._save.getFleetById(idOrHandle);
		const array = this.$('fleets_manager').$('owned_fleets').valueAsObject();
		const index = array.findIndex(o => $(o[1]).$('fleet')._ == id);
		if (index !== -1) {
			const ownership = new FleetOwnershipHandle($(array[index]?.[1]!), this);
			const previousOwnerId = ownership.previousOwnerId;
			if (previousOwnerId) {
				// TODO: update fleet owner cache
				ownership.previousOwner!.registerOwnedFleet(handle);
			}
			array.splice(index, 1);
		}
	}

	////////////////////////////////////////////////////////////////////////////////

	get fleetTemplatesCount(): number {
		return this.$('fleet_template_manager').$('fleet_template').$$().length;
	}
	get fleetTemplatesIds(): ReadonlyArray<number> {
		return this.$('fleet_template_manager').$('fleet_template').$$().map(e => e._ as number);
	}
	get fleetTemplates(): ReadonlyArray<FleetTemplateHandle> {
		return this.fleetTemplatesIds.map(id => this._save.getFleetTemplateById(id));
	}

	registerFleetTemplate(idOrHandle: number | FleetTemplateHandle) {
		const id = idOrHandle instanceof FleetTemplateHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('fleet_template_manager').$('fleet_template').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index === -1) {
			array.push([null, id]);
		}
	}
	unregisterFleetTemplate(idOrHandle: number | FleetTemplateHandle) {
		const id = idOrHandle instanceof FleetTemplateHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('fleet_template_manager').$('fleet_template').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index !== -1) {
			array.splice(index, 1);
		}
	}

	////////////////////////////////////////////////////////////////////////////////

	// TODO: armies
	// TODO: economy

	////////////////////////////////////////////////////////////////////////////////

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
		fleets?: boolean,
		fleetTemplates?: boolean,
	} = {}) {
		settings = Object.assign({
			// removeSpecies: false,
			fleets: true,
			fleetTemplates: true,
		}, settings);

		console.debug(`Removing country '${this.name}' #${this.id}`);

		// Remove leaders. Don't have to unassign them from sector and ships,
		// as we remove the sector and ships as well.
		for (const leader of this._save.leaders) {
			if (leader.countryId === this.id) {
				leader.value = undefined;
			}
		}
		this._save.leaders = this._save.leaders.filter(h => h.value != undefined);

		// TODO: factions

		// Remove fleets
		if (settings.fleets) {
			for (const fleet of this.ownedFleets) {
				fleet.remove();
			}
		}

		// Fleet templates
		if (settings.fleetTemplates) {
			for (const template of this.fleetTemplates) {
				template.value = undefined;
			}
			this._save.fleetTemplates = this._save.fleetTemplates.filter(h => h.value != undefined);
		}
		else {
			if (settings.fleets) {
				for (const template of this.fleetTemplates) {
					template.setFleet(undefined);
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
		this._save.armies = this._save.armies.filter(h => h.value != undefined);

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
		this._save.sectors = this._save.sectors.filter(h => h.value != undefined);

		// TODO: event targets?

		this.value = undefined;
	}
}

export default CountryHandle;
