import { $, ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import CountryHandle from "./CountryHandle";
import ShipHandle from "./ShipHandle";
import CoordsHandle, { GalaxyOrigin } from "./CoordsHandle";
import FleetTemplateHandle from "./FleetTemplateHandle";
import { MyError } from "@/utils/common";

const getNewIdForNewFleet = (save: StellarisSave) => {
	let id = save.gamestate.$('last_created_fleet').value as number + 1;
	while (save.findFleetById(id)) {
		id += 1;
	}
	save.gamestate.$('last_created_fleet').value = id;
	return id;
}

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
		return stripSidesByCharacter(this.$('name').$('key')._ as string);
	}
	set name(value: string) {
		this.$('name').$('key')._ = `"${value}"`;
	}

	// TODO: combat/movement managers
	// TODO: stats, hps, power
	// TODO: options (ground_support_stance, friends_should_follow, mobile/station flags)

	get isStation() {
		return this.$('station').value == 'yes';
	}
	set isStation(value: boolean) {
		this.$('station').value = value ? 'yes' : undefined;
	}

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
		if (this.ships.length == 0) {
			// Ignore silently, it's fleet under construction
			return;
		}
		this.coords = CoordsHandle.averageForPoints(...this.ships.map(ship => ship.coords));
		// TODO: enforce single ship origin?
	}

	updateHitpoints() {
		let total = 0;
		for (const ship of this.ships) {
			total += ship.hullHP;
		}
		this.$('hit_points').value = total;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Combat

	get fleetsIdsInCombatWith() {
		return this.$('combat').$('in_combat_with').valueAsObject()
			.map(e => (e[1] as ParadoxDataObject).find(e => e[0] === 'fleet')?.[1] as number | undefined)
			.filter(e => e !== undefined) as number[];
	}
	get fleetsInCombatWith() {
		return this.fleetsIdsInCombatWith.map(id => this._save.getFleetById(id));
	}

	/**
	 * Sets combat between two fleets.
	 * @param idOrHandle 
	 */
	combat(idOrHandle: FleetHandle | number) {
		const other = idOrHandle instanceof FleetHandle ? idOrHandle : this._save.getFleetById(idOrHandle);
		const otherId = idOrHandle instanceof FleetHandle ? other.id : idOrHandle;

		this._combat(otherId);
		other._combat(this.id);

		// TODO: check whenever start_coordinate/start_date actually are reset when combat ends
		if (this.$('start_coordinate').$('origin').value as number === GalaxyOrigin) {
			this.$('start_coordinate').value = this.coords.copy().value;
			this.$('start_date').value = this._save.dateRaw;
		}
	}

	_combat(id: number) {
		const entries = this.$('combat').$('in_combat_with').valueAsObject();
		if (entries.find(e => $(e[1]).$('fleet').value as number === id)) {
			return; // already in combat
		}
		entries.push([null, [
			['fleet', id],
		]]);
	}

	////////////////////////////////////////////////////////////////////////////////
	// Orders

	orderAttack(idOrHandle: FleetHandle | number) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		this.$('movement_manager').$('target').$('target').value = [
			['type', 3],
			['id', id],
		];
		this.$('order_id').value = 1;
		this.$('current_order').$('follow_order').value = [
			['fleet', id],
			['attack_when_in_range', 'yes'],
			['order_id', 0],
		];
	}

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get templateId() {
		return this.$('fleet_template')._ as number | undefined;
	}
	getTemplate() {
		return this.templateId == undefined ? undefined : this._save.getFleetTemplateById(this.templateId);
	}
	setTemplate(idOrHandle: number | FleetTemplateHandle | undefined) {
		const id = idOrHandle instanceof FleetTemplateHandle ? idOrHandle.id : idOrHandle;
		this.$('fleet_template')._ = id;
	}

	findOwner() {
		// TODO: cache owner?
		for (const country of this._save.countries) {
			if (country.ownedFleetsIds.includes(this.id)) {
				return country;
			}
		}
		throw new MyError('invalid-state/fleet/no-owner', `Fleet ${this.id} has no owner`);
	}

	get shipsIds(): ReadonlyArray<number> {
		return this.$('ships').$$().map(e => e._ as number);
	}
	get ships(): ReadonlyArray<ShipHandle> {
		return this.$('ships').$$().map(e => this._save.getShipById(e._ as number));
	}

	/**
	 * Removes ship from fleet ships list.
	 * 
	 * Note: ship should be then either assigned to other fleet, or removed
	 * from gamestate (might want to use `ShipHandle.remove()`).
	 */
	removeShip(idOrHandle: number | ShipHandle) {
		const id = idOrHandle instanceof ShipHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('ships').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index === -1) {
			// Already outside
			return;
		}
		array.splice(index, 1);	
	}

	/**
	 * Adds ship into fleet ships list.
	 */
	addShip(idOrHandle: number | ShipHandle) {
		const id = idOrHandle instanceof ShipHandle ? idOrHandle.id : idOrHandle;
		const handle = idOrHandle instanceof ShipHandle ? idOrHandle : this._save.getShipById(idOrHandle);
		if (this.shipsIds.includes(id)) {
			// Already inside
			return;
		}
		this.$('ships').valueAsObject().push([null, id]);
		if (handle.fleetId !== this.id) {
			handle.getFleet().removeShip(handle);
			handle.setFleet(this);
		}
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

	remove(settings: {
		updateSave?: boolean,
		removeTemplate?: boolean,
	} = {}) {
		settings = Object.assign({
			updateSave: true,
			removeTemplate: false,
		}, settings);

		// Ships
		for (const ship of this.ships) {
			ship.remove({ updateFleet: false });
		}

		// Country
		this.findOwner().unregisterOwnedFleet(this);
		if (this.id == 0) console.warn(`DELETED FLEET ID #0`)

		// System
		const systemId = this.coords.origin;
		const system = this._save.getSystemById(systemId);
		system.unregisterFleet(this);

		// Orbit (around planets/starships, if any)
		this.unassignOrbit();

		// Starship
		if (this.isStation) {
			system.setStarbase(undefined);
		}

		// Templates
		const template = this.getTemplate();
		if (template) {
			if (settings.removeTemplate) {
				template.remove({
					updateSave: settings.updateSave,
					removeFleet: false,
				});
			}
			template.setFleet(undefined);
		}
		this.setTemplate(undefined);

		// Remove
		this.value = undefined;
		if (settings.updateSave) {
			this._save.fleets = this._save.fleets.filter(h => h.value != undefined);
		}
	}

	static async newFromTemplate(
		template: FleetTemplateHandle, 
		country: CountryHandle, 
		coords: CoordsHandle, 
		name?: string
	) {
		const save = template._save;
		const id = getNewIdForNewFleet(save);
		name ||= `Fleet ID ${id}`;

		console.debug(`Adding new fleet ID ${id} named '${name}' for country ID ${country.id}`);

		const object: ParadoxDataObject = [
			['name', [
				['key', `"${name!}"`],
			]],
			['fleet_template', template.id],
			['ships', []],
			['combat', [
				// ['coordinate', [...]], ...
			]],
			['owner', country.id],
			['movement_manager', [
				// ['formation', [
				// 	['scale', 1],
				// 	['angle', 0],
				// 	['type', 'wedge'],
				// ]],
				['coordinate', undefined], // updated below
			]],
			['friends_should_follow', 'no'],
			['mobile', 'yes'],
			['hit_points', 0],
		];
		const entry: ParadoxDataEntry = [id, object];
		const fleet = new FleetHandle(entry, save);

		country.$('sensor_range_fleets').valueAsObject().push([null, id]);
		country.registerOwnedFleet(fleet);
		//fleet._owner = country; // TODO: fleet owner cache

		fleet.coords = coords;
		for (const entry of template.composition) {
			const design = save.getShipDesignById(entry.designId);
			for (let i = 0; i < entry.count; i++) {
				await ShipHandle.newFromDesign(design, fleet);
			}
		}
		fleet.updateCoordsToShipsAverage();
		fleet.updateHitpoints();

		const system = save.getSystemById(coords.origin);
		system.registerFleet(fleet);

		save.fleets.push(fleet);
		save.gamestate.$('fleet').valueAsObject().push(entry);

		return fleet;
	}
}

export default FleetHandle;
