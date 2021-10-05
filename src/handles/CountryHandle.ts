import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import { PlanetHandle } from "..";

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

	get capital() {
		return this._save.findPlanetById(this.$('capital')._ as number);
	}
	set capital(idOrHandle: number | PlanetHandle | undefined) {
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
	// TODO: rules & leaders
	// TODO: fleets
	// TODO: armies
	// TODO: economy
}

export default CountryHandle;
