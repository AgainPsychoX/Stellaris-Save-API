import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import CoordsHandle from "./CoordsHandle";
import LeaderHandle from "./LeaderHandle";
import FleetHandle from "./FleetHandle";
import ShipDesignHandle from "./ShipDesignHandle";
import { getLogger } from "@/utils/logging";

const addingShipLogger = getLogger('adding-ship');

const getNewIdForNewShip = (save: StellarisSave) => {
	let id = save.gamestate.$('last_created_ship').value as number + 1;
	while (save.findShipById(id)) {
		id += 1;
	}
	save.gamestate.$('last_created_ship').value = id;
	return id;
}

export class ShipWeaponHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	get slot() {
		return stripSidesByCharacter(this.$('component_slot')._ as string);
	}

	get template() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set template(value: string) {
		this.$('template')._ = `"${value}"`;
	}
}

export class ShipSectionHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	get slot() {
		return stripSidesByCharacter(this.$('slot')._ as string);
	}

	get template() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set template(value: string) {
		this.$('template')._ = `"${value}"`;
	}

	// TODO: weapons? idk, those handles will be hardly ever useful...
}

export class ShipHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;
	_sections: Map<string, ShipSectionHandle>;
	_sectionsKeys: string[];

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
		this._sections = new Map(
			this.$$('section').map(e => [
				stripSidesByCharacter(e.$('slot')._ as string),
				new ShipSectionHandle(e)
			] as const)
		);
		this._sectionsKeys = [...this._sections.keys()];
	}

	////////////////////////////////////////////////////////////////////////////////
	// Base stuff

	get id() {
		return this.key as number;
	}

	get name() {
		const nameEntry = this.$('name');
		if (nameEntry.value === undefined) return undefined;
		return stripSidesByCharacter(nameEntry.$('key')._ as string);
	}
	set name(value: string | undefined) {
		if (value === undefined) {
			this.removeSubentriesByKey('name');
		}
		this.$('name').$('key')._ = `"${value}"`;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Position and rotation

	get coords() {
		return new CoordsHandle(this.$('coordinate')._ as ParadoxDataObject);
	}
	set coords(value: CoordsHandle) {
		this.$('coordinate')._ = value._;
	}

	get targetCoords() {
		return new CoordsHandle(this.$('target_coordinate')._ as ParadoxDataObject);
	}
	set targetCoords(value: CoordsHandle) {
		this.$('target_coordinate')._ = value._;
	}

	// There is more, but who cares about rotation?

	////////////////////////////////////////////////////////////////////////////////
	// Build
	
	get graphicalCulture() {
		return stripSidesByCharacter(this.$('graphical_culture')._ as string);
	}
	set graphicalCulture(value: string) {
		this.$('graphical_culture')._ = `"${value}""`;
	}

	/**
	 * Allow access sections by slot key (assuming they are unique).
	 */
	get sections() {
		return new Proxy({}, {
			get: (_, key: string | Symbol) => {
				if (typeof key == 'string') {
					return this._sections.get(key);
				}
				if (key === Symbol.iterator) {
					const that = this;
					return () => ({
						index: -1,
						next: function() {
							const key = that._sectionsKeys[++this.index];
							return {
								done: !key,
								value: key ? that._sections.get(key) : undefined,
							}
						}
					})
				}
				return undefined;
			},
			set: (_, key: string, value: ShipSectionHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const slotEntryIndex = entries.findIndex(e => e[0] === 'slot');
						entries.splice(slotEntryIndex, 0, ['section', value._]);
						this._sections.set(key, value);
						this._sectionsKeys.push(key);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
					if (value) {
						this._sections.set(key, value);
					}
					else {
						this._sections.delete(key);
						this._sectionsKeys = this._sectionsKeys.filter(a => a == key);
					}
				}
				this.updateWeaponIndexes();
				return true;
			},
		}) as ShipSectionHandle[];
	}

	updateWeaponIndexes() {
		// TODO: ... is it really necessary anyway?
		// this.$('next_weapon_index').value
	}

	////////////////////////////////////////////////////////////////////////////////
	// Status

	get hullHP() {
		return this.$('hitpoints')._ as number;
	}
	set hullHP(value: number) {
		this.$('hitpoints')._ = value;
	}

	get shieldHP() {
		return this.$('shield_hitpoints')._ as number;
	}
	set shieldHP(value: number) {
		this.$('shield_hitpoints')._ = value;
	}

	get armorHP() {
		return this.$('armor_hitpoints')._ as number;
	}
	set armorHP(value: number) {
		this.$('armor_hitpoints')._ = value;
	}

	get maxHullHP() {
		return this.$('max_hitpoints')._ as number;
	}
	set maxHullHP(value: number) {
		this.$('max_hitpoints')._ = value;
	}

	get maxShieldHP() {
		return this.$('max_shield_hitpoints')._ as number;
	}
	set maxShieldHP(value: number) {
		this.$('max_shield_hitpoints')._ = value;
	}

	get maxArmorHP() {
		return this.$('max_armor_hitpoints')._ as number;
	}
	set maxArmorHP(value: number) {
		this.$('max_armor_hitpoints')._ = value;
	}

	get upgradeProgress() {
		return this.$('upgrade_progress')._ as number;
	}
	set upgradeProgress(value: number) {
		this.$('upgrade_progress')._ = value;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Related

	get fleetId() {
		return this.$('fleet')._ as number;
	}
	getFleet() {
		return this._save.getFleetById(this.fleetId);
	}
	setFleet(idOrHandle: number | FleetHandle) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		this.$('fleet').value = id;
		// TODO: owner? same origin?
	}

	get designId() {
		return this.$('ship_design')._ as number;
	}
	get design() {
		return this._save.getShipDesignById(this.designId);
	}

	get designUpgradeId() {
		return this.$('design_upgrade')._ as number;
	}
	get designUpgrade() {
		return this._save.getShipDesignById(this.designUpgradeId);
	}

	get leaderId() {
		return this.$('leader')._ as number | undefined;
	}
	getLeader() {
		return this.leaderId == undefined ? undefined : this._save.getLeaderById(this.leaderId);
	}
	setLeader(idOrHandle: number | LeaderHandle | undefined) {
		const id = idOrHandle instanceof LeaderHandle ? idOrHandle.id : idOrHandle;
		this.$('leader')._ = id;
	}

	get experience() {
		return (this.$('experience').value as number | undefined) || 0;
	}
	set experience(value: number) {
		this.$('experience').value = value;
	}

	remove(settings: {
		updateFleet?: boolean,
	} = {}) {
		settings = Object.assign({
			updateFleet: true,
		}, settings);

		this.getLeader()?.unassign();
		if (settings.updateFleet) {
			this.getFleet().removeShip(this);
		}

		// Remove from save global handles list
		{
			const index = this._save.ships.indexOf(this);
			if (index !== -1) {
				this._save.ships.splice(index, 1);
			}
		}

		// Remove from gamestate structure
		{
			const array = this._save.gamestate.$('ships').valueAsObject();
			const index = array.findIndex(e => e[0] == this.id);
			if (index !== 1) {
				array.splice(index, 1);
			}
		}

		// TODO: event targets?
	}

	static async newFromDesign(design: ShipDesignHandle, fleet: FleetHandle, name?: string) {
		const save = fleet._save;
		const country = fleet.findOwner();
		const id = getNewIdForNewShip(save);
		name ||= `Ship ID ${id}`;
		addingShipLogger.debug(`Adding new ship ID ${id} named '${name}' for country ID ${country.id}`);

		// Make sure save includes design
		const found = save.findShipDesignById(design.id);
		if (found && found.value == design.value) {
			// Okay, it's the one.
		}
		else {
			design = design.copy(save);
		}

		const hitpoints = await design.calculateMaxHitpoints();

		// Prepare new ship
		const coords = fleet.coords.copy();
		const object: ParadoxDataObject = [
			['fleet', fleet.id],
			['name', [
				['key', `"${name}"`],
			]],
			['reserve', 0],
			['ship_design', design.id],
			// ['design_upgrade', design.id],
			['graphical_culture', `"${country.shipGraphicalCulture}"`],
		];
		const entry: ParadoxDataEntry = [id, object];

		// Copy sections (with 'weapon' for each weapon type component)
		let nextWeaponIndex = 0;
		for (const section of design.sections) {
			const sectionObject: ParadoxDataObject = [
				['design', section.$('template').value],
				['slot', section.$('slot').value],
			];
			const sectionEntry: ParadoxDataEntry = ['section', sectionObject];
			for (const component of section.components) {
				const template = await component.getTemplate();
				if (template.type == 'weapon') {
					sectionObject.push(
						['weapon', [
							['index', nextWeaponIndex++],
							['template', component.$('template').value],
							['component_slot', component.$('slot').value],
						]]
					);
				}
			}
			object.splice(7, 0, sectionEntry);
		}

		// Finish the entry
		object.push(
			['coordinate', coords.value],
			['target_coordinate', coords.value],
			['post_move_angle', 0],
			['hitpoints', hitpoints.hull],
			['shield_hitpoints', hitpoints.shield],
			['armor_hitpoints', hitpoints.armor],
			['max_hitpoints', hitpoints.hull],
			['max_shield_hitpoints', hitpoints.shield],
			['max_armor_hitpoints', hitpoints.armor],
			['rotation', 0],
			['forward_x', 1],
			['forward_y', 0],
			['upgrade_progress', 0],
			['next_weapon_index', nextWeaponIndex],
		);
		const handle = new ShipHandle(entry, save);

		// Register the ship
		fleet.addShip(handle);
		save.ships.push(handle);
		save.gamestate.$('ships').valueAsObject().push(entry);

		return handle;
	}
}

export default ShipHandle;
