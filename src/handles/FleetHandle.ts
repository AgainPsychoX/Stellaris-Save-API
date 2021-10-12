import { ParadoxDataEntry, ParadoxDataEntryHandle, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import CountryHandle from "./CountryHandle";
import ShipHandle from "./ShipHandle";
import CoordsHandle from "./CoordsHandle";

export class FleetHandle extends ParadoxDataEntryHandle {
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

	// TODO: combat/movement managers
	// TODO: stats, hps, power
	// TODO: options (ground_support_stance, friends_should_follow, mobile/station flags)

	/**
	 * Approximated coords of the fleet.
	 */
	get coords() {
		return new CoordsHandle(this.$('movement_manager').$('coordinate').valueAsObject());
	}
	set coords(value: CoordsHandle) {
		this.$('movement_manager').$('coordinate')._ = value._;
	}

	updateCoordsToShipsAverage() {
		this.coords = CoordsHandle.averageForPoints(...this.ships.map(ship => ship.coords));
	}

	////////////////////////////////////////////////////////////////////////////////
	// Related

	// TODO: fleet template

	get ownerId() {
		return this.$('owner')._ as number;
	}
	get owner() {
		return this._save.getCountryById(this.ownerId);
	}
	set owner(idOrHandle: number | CountryHandle) {
		this.$('owner')._ = idOrHandle instanceof CountryHandle ? idOrHandle.id : idOrHandle;
	}

	get shipsIds(): ReadonlyArray<number> {
		return this.$('ships').$$().map(e => e._ as number);
	}
	get ships(): ReadonlyArray<ShipHandle> {
		return this.$('ships').$$().map(e => this._save.getShipById(e._ as number));
	}

	removeShip(idOrHandle: number | ShipHandle) {
		const id = idOrHandle instanceof ShipHandle ? idOrHandle.id : idOrHandle;
		const handle = idOrHandle instanceof ShipHandle ? idOrHandle : this._save.getShipById(idOrHandle);
		if (!this.shipsIds.includes(id)) {
			// Already outside
		}
		this.$('ships').valueAsObject().push([null, id]);
		handle.setFleet(this);
		
	}

	get designId() {
		return this.$('ship_design')._ as number;
	}
	get design() {
		return this._save.findShipDesignById(this.designId);
	}

	get designUpgradeId() {
		return this.$('design_upgrade')._ as number;
	}
	get designUpgrade() {
		return this._save.findShipDesignById(this.designUpgradeId);
	}

	////////////////////////////////////////////////////////////////////////////////
	// Other
	
	unassignOrbit() {
		// TODO: test
		const orbitEntry = this.$('movement_manager').$('orbit');
		const orbitIndex = orbitEntry.$('index')._ as number | undefined;
		const orbitableEntry = this.$('orbitable');

		if (orbitIndex) {
			const starbaseId = orbitableEntry.$('starbase')._ as number | undefined;
			if (starbaseId != undefined) {
				const starbase = this._save.getShipById(starbaseId);
				const planetId = starbase.$('movement_manager').$('orbit').$('orbitable').$('planet')._ as number | undefined;
				if (planetId != undefined) {
					const planet = this._save.getPlanetById(planetId);
					planet.$('planet_orbitals').$(orbitIndex)._ = undefined;
				}
			}

			const planetId = orbitableEntry.$('planet')._ as number | undefined;
			if (planetId != undefined) {
				const planet = this._save.getPlanetById(planetId);
				planet.$('planet_orbitals').$(orbitIndex)._ = undefined;
			}
		}

		orbitEntry.value = [];
	}
}

export default FleetHandle;
