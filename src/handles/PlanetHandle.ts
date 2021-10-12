import StellarisSave from "@/StellarisSave";
import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import ArmyHandle from "./ArmyHandle";
import { CoordsHandle } from "./CoordsHandle";
import CountryHandle from "./CountryHandle";

export class PlanetHandle extends ParadoxDataEntryHandle {
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

	get coords() {
		return new CoordsHandle(this.$('coordinate')._ as ParadoxDataObject);
	}
	set coords(value: CoordsHandle) {
		this.$('coordinate')._ = value._;
	}

	get class() {
		return stripSidesByCharacter(this.$('planet_class')._ as string);
	}
	set class(value: string) {
		this.$('planet_class')._ = `"${value}"`;
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

	// TODO: a lot of stuff (flags, ...)

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get ownerId() {
		return this.$('owner')._ as number | undefined;
	}
	get owner() {
		return this.ownerId == undefined ? undefined : this._save.getCountryById(this.ownerId);
	}
	set owner(idOrHandle: number | CountryHandle | undefined) {
		this.$('owner')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	get originalOwnerId() {
		return this.$('originalOwner')._ as number | undefined;
	}
	get originalOwner() {
		return this.originalOwnerId == undefined ? undefined : this._save.getCountryById(this.originalOwnerId);
	}
	set originalOwner(idOrHandle: number | CountryHandle | undefined) {
		this.$('owner')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	get controllerId() {
		return this.$('controller')._ as number | undefined;
	}
	get controller() {
		return this.controllerId == undefined ? undefined : this._save.getCountryById(this.controllerId);
	}
	set controller(idOrHandle: number | CountryHandle | undefined) {
		this.$('controller')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	get surveyedByCountryId() {
		return this.$('surveyed_by')._ as number | undefined;
	}
	get surveyedByCountry() {
		return this.surveyedByCountryId == undefined ? undefined : this._save.getCountryById(this.surveyedByCountryId);
	}
	set surveyedByCountry(idOrHandle: number | CountryHandle | undefined) {
		this.$('surveyed_by')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	// TODO: orbitals?

	get popsIds(): ReadonlyArray<number> {
		return this.$('pop').$$().map(e => e.value as number);
	}
	// TODO: get pops(): Readonly<PopHandle> {}

	get armiesIds(): ReadonlyArray<number> {
		return this.$('army').$$().map(e => e.value as number);
	}
	get armies(): ReadonlyArray<ArmyHandle> {
		return this.armiesIds.map(id => this._save.getArmyById(id));
	}

	////////////////////////////////////////////////////////////////////////////////

	decolonize() {
		this.owner = undefined;
		this.$('job_cache').value = undefined;

		// Remove pops
		{
			const ids = this.popsIds;
			const popsEntries = this._save.gamestate.$('pop').valueAsObject();
			for (const entry of popsEntries) {
				if (ids.includes(entry[0] as number)) {
					entry[1] = undefined;
				}
			}
			// TODO: update this._save.pops
			this.$('pop').value = undefined;
		}

		// Remove armies
		{
			const ids = this.armiesIds;
			for (const army of this._save.armies) {
				if (ids.includes(army.id)) {
					army.value = undefined;
				}
			}
		}

		// TODO: building, districts?
	}

	////////////////////////////////////////////////////////////////////////////////
}

export default PlanetHandle;
