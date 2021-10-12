import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import CoordsHandle from "./CoordsHandle";
import { LeaderHandle } from "..";
import FleetHandle from "./FleetHandle";

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

	/**
	 * Allow access section weapons by slot key (assuming they are unique).
	 */
	get weapons() {
		return new Proxy({}, {
			get: (_, key: string) => {
				const entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				return entry ? new ShipWeaponHandle(entry) : undefined;
			},
			set: (_, key: string, value: ShipWeaponHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const slotEntryIndex = entries.findIndex(e => e[0] === 'slot');
						entries.splice(slotEntryIndex, 0, ['section', value._]);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
				}
				return true;
			},
		}) as (ShipWeaponHandle | undefined)[];
	}
}

export class ShipHandle extends ParadoxDataEntryHandle {
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

	get keyName() {
		return stripSidesByCharacter(this.$('key')._ as string);
	}
	set keyName(value: string) {
		this.$('key')._ = `"${value}"`;
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
			get: (_, key: string) => {
				const entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				return entry ? new ShipSectionHandle(entry) : undefined;
			},
			set: (_, key: string, value: ShipSectionHandle | undefined) => {
				// TODO: working add/delete, as `next_weapon_index`/weapon `index` might be necessary.
				throw new Error('not-implemented');
				// let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				// if (!entry) {
				// 	if (value) {
				// 		const entries = this._ as ParadoxDataEntry[];
				// 		const slotEntryIndex = entries.findIndex(e => e[0] === 'slot');
				// 		entries.splice(slotEntryIndex, 0, ['section', value._]);
				// 	}
				// }
				// else {
				// 	entry._ = value ? value._ : undefined;
				// }
				// return true;
			},
		}) as (ShipSectionHandle | undefined)[];
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

	remove() {
		this.getLeader()?.unassign();
		this.getFleet().removeShip(this);

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
	}
}

export default ShipHandle;
