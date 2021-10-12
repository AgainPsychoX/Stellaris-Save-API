import { ParadoxDataEntry, ParadoxDataEntryHandle, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import CountryHandle from "./CountryHandle";
import ShipHandle from "./ShipHandle";
import PlanetHandle from "./PlanetHandle";
import SpeciesHandle from "./SpeciesHandle";

export class ArmyHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
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
		this.$('type')._ = `"${value}"`;
	}

	get health() {
		return this.$('health')._ as number;
	}
	set health(value: number) {
		this.$('health')._ = value;
	}

	get maxHealth() {
		return this.$('max_health')._ as number;
	}
	set maxHealth(value: number) {
		this.$('max_health')._ = value;
	}

	get morale() {
		return this.$('morale')._ as number;
	}
	set morale(value: number) {
		this.$('morale')._ = value;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get ownerId() {
		return this.$('owner')._ as number;
	}
	get owner() {
		return this._save.getCountryById(this.ownerId);
	}
	set owner(idOrHandle: number | CountryHandle) {
		this.$('owner')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	get speciesId() {
		return this.$('species')._ as number;
	}
	get species() {
		return this._save.getSpeciesByIndex(this.speciesId);
	}
	set species(idOrHandle: number | SpeciesHandle) {
		this.$('species')._ = idOrHandle instanceof SpeciesHandle ? idOrHandle.index : idOrHandle;
	}

	get homePlanetId() {
		return this.$('home_planet')._ as number;
	}
	get homePlanet() {
		return this._save.getPlanetById(this.homePlanetId);
	}
	set homePlanet(idOrHandle: number | PlanetHandle) {
		this.$('home_planet')._ = idOrHandle instanceof PlanetHandle ? idOrHandle.id : idOrHandle;
	}

	get planetId() {
		return this.$('planet')._ as number | undefined;
	}
	get planet() {	
		return this.planetId ? this._save.getPlanetById(this.planetId) : undefined;
	}
	set planet(idOrHandleOrUndefined: number | PlanetHandle | undefined) {
		this.$('planet')._ = idOrHandleOrUndefined instanceof PlanetHandle ? idOrHandleOrUndefined.id : idOrHandleOrUndefined;
	}

	get shipId() {
		return this.$('ship')._ as number | undefined;
	}
	get ship() {	
		return this.shipId ? this._save.getShipById(this.shipId) : undefined;
	}
	set ship(idOrHandleOrUndefined: number | ShipHandle | undefined) {
		this.$('ship')._ = idOrHandleOrUndefined instanceof ShipHandle ? idOrHandleOrUndefined.id : idOrHandleOrUndefined;
	}

	// TODO: pop
}

export default ArmyHandle;
