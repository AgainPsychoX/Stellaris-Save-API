import StellarisSave from "@/StellarisSave";
import { ParadoxDataEntry, ParadoxDataEntryHandle, stripSidesByCharacter } from "@/utils/paradox";
import { PlanetHandle } from "..";
import CountryHandle from "./CountryHandle";
import SectorHandle from "./SectorHandle";
import ShipHandle from "./ShipHandle";

export class LeaderHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Base

	get id() {
		return this.key as number;
	}

	get firstName() {
		return stripSidesByCharacter(this.$('name').$('first_name')._ as string);
	}
	set firstName(value: string) {
		this.$('name').$('first_name')._ = `"${value}"`;
	}

	get secondName() {
		return stripSidesByCharacter(this.$('name').$('second_name')._ as string);
	}
	set secondName(value: string) {
		this.$('name').$('second_name')._ = `"${value}"`;
	}

	get gender() {
		return this.$('gender')._ as string;
	}
	set gender(value: string) {
		this.$('gender')._ = value;
	}

	get age() {
		return this.$('age')._ as number;
	}
	set age(value: number) {
		this.$('age')._ = value;
	}

	get level() {
		return this.$('level')._ as number;
	}
	set level(value: number) {
		this.$('level')._ = value;
	}

	// TODO: a lot of stuff (pick date, agenda/mandate location, portrait/design, class, roles/traits)

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get countryId() {
		return this.$('country')._ as number;
	}
	get country() {
		return this._save.getCountryById(this.countryId);
	}
	set country(idOrHandle: number | CountryHandle) {
		this.$('country')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	////////////////////////////////////////////////////////////////////////////////

	getLocation() {
		const location = this.$('location');
		const type = location.$('type').value as string;
		const id = location.$('id').value as number;
		switch (type) {
			case 'planet': {
				return [this._save.getPlanetById(id)] as const;
			}
			case 'sector': {
				return [this._save.getSectorById(id)] as const;
			}
			case 'tech': {
				return [this._save.getCountryById(id), location.$('area').value as 'physics' | 'society' | 'engineering'] as const;
			}
			case 'ship': {
				return [this._save.getShipById(id)] as const;
			}
			default:
				return [];
		}
	}

	setLocation(value: [handle: PlanetHandle | SectorHandle | CountryHandle | ShipHandle, area?: string, assignment?: string]) {
		// TODO: check type?
		const location = this.$('location');
		const handle = value[0];
		if (handle instanceof PlanetHandle) {
			location.$('type').value = 'planet';
			location.$('id').value = handle.id;
		}
		else if (handle instanceof ShipHandle) {
			location.$('type').value = 'ship';
			location.$('id').value = handle.id;
			handle.setLeader(this);
		}
		else if (handle instanceof CountryHandle) {
			location.$('type').value = 'tech';
			location.$('id').value = handle.id;
		}
		else if (handle instanceof SectorHandle) {
			location.$('type').value = 'sector';
			location.$('id').value = handle.id;
		}
		else {
			// Never.
		}
		location.$('area').value = value[1] || 'none';
		location.$('assignment').value = value[2] || 'none';
	}

	/**
	 * Unassigns leader from any assignment (ruler, scientist leader, governor,
	 * science ship, military ship). Does not remove leader from pool.
	 */
	unassign(country?: CountryHandle) {
		if (!country) {
			country = this._save.getCountryById(this.countryId);
		}
		if (this.id === country.rulerId) {
			country.ruler = undefined;
		}
		if (this.id === country.getScientistLeaderId('physics')) {
			country.setScientistLeader('physics', undefined);
		}
		if (this.id === country.getScientistLeaderId('society')) {
			country.setScientistLeader('society', undefined);
		}
		if (this.id === country.getScientistLeaderId('engineering')) {
			country.setScientistLeader('engineering', undefined);
		}
		const location = this.getLocation();
		const handle = location[0];
		if (handle instanceof PlanetHandle) {
			// Ruler or unassigned, nothing to do?
		}
		else if (handle instanceof ShipHandle) {
			handle.setLeader(undefined);
		}
		else if (handle instanceof CountryHandle) {
			// Ruler or tech, nothing to do?
		}
		else if (handle instanceof SectorHandle) {
			handle.setGovernor(undefined);
		}
		this.setLocation([country.getCapital()]);
	}

	remove(settings: {
		removeCountryRelation?: boolean;
	} = {}) {
		settings = Object.assign({
			removeCountryRelation: true,
		}, settings);

		if (settings.removeCountryRelation) {
			const country = this._save.findCountryById(this.countryId);
			if (country) {
				this.unassign();
				if (country.ownedLeadersIds.includes(this.id)) {
					country.removeLeader(this);
				}
			}
		}

		// TODO: events?
		// TODO: archeologist?
	}
}

export default LeaderHandle;
