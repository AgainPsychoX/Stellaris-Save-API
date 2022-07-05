import { $, ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import { MyError } from "@/utils/common";
import { CoordsHandle, GalaxyOrigin } from "./CoordsHandle";
import PlanetHandle from "./PlanetHandle";
import SectorHandle, { UndefinedSectorId } from "./SectorHandle";
import ShipHandle from "./ShipHandle";
import FleetHandle from "./FleetHandle";

const getNewIdForNewSystem = (save: StellarisSave) => {
	let id = save.gamestate.$('last_created_system').value as number + 1;
	while (save.findShipById(id)) {
		id += 1;
	}
	save.gamestate.$('last_created_system').value = id;
	return id;
}

export const precursorsFlags = ['precursor_1', 'precursor_2', 'precursor_3', 'precursor_4', 'precursor_5', 'precursor_zroni_1', 'precursor_baol_1'] as const;
export type PrecursorFlag = typeof precursorsFlags[number];

export const precursorFlagToName: Record<PrecursorFlag, string> = {
	'precursor_1': 'Cybrex', 
	'precursor_2': 'First League', 
	'precursor_3': 'Irassian Concordat', 
	'precursor_4': 'Vultaum Star Assembly',
	'precursor_5': 'Yuht Empire', 
	'precursor_zroni_1': 'Baol', 
	'precursor_baol_1': 'Zroni',
} as const;

type OnMissingSetting = 'error' | 'warning' | 'ignore';

export class SystemHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;
	_coords: CoordsHandle;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
		this._coords = new CoordsHandle(this.$('coordinate')._ as ParadoxDataObject);
	}

	get id() {
		return this.key as number;
	}

	get name() {
		return stripSidesByCharacter(this.$('name').$('key')._ as string);
	}
	set name(value: string) {
		this.$('name').$('key')._ = `"${value}"`;
	}

	get coords() {
		return this._coords;
	}
	set coords(value: CoordsHandle) {
		this._coords = value;
		this.$('coordinate')._ = value._;
	}

	get flags() {
		return new Proxy({}, {
			get: (_, name: string) => {
				return this.$('flags').$(name).value;
			},
			set:  (_, name: string, value: boolean | string | number | undefined) => {
				if (!!value) {
					this.$('flags').$(name).value = typeof value === 'boolean' ? 62808000 : value;
				}
				else {
					this.$('flags').$(name).value = undefined;
				}
				return true;
			},
		}) as { [key: string]: boolean | string | number | undefined };
	}

	get initializer() {
		return stripSidesByCharacter(this.$('initializer')._ as string);
	}
	set initializer(value: string) {
		this.$('initializer')._ = `"${value}"`;
	}

	get starClass() {
		return stripSidesByCharacter(this.$('star_class')._ as string);
	}
	set starClass(value: string) {
		this.$('star_class')._ = `"${value}"`;
	}

	get innerRadius() {
		return this.$('inner_radius')._ as number;
	}
	set innerRadius(value: number) {
		this.$('inner_radius')._ = value;
	}

	get outerRadius() {
		return this.$('outer_radius')._ as number;
	}
	set outerRadius(value: number) {
		this.$('outer_radius')._ = value;
	}

	setRadius(inner: number, outer?: number) {
		this.innerRadius = inner;
		this.outerRadius = outer === undefined ? (inner + 100) : outer;
	}

	////////////////////////////////////////////////////////////////////////////////

	addHyperlanes(
		systemList: (SystemHandle | number)[],
		settings = { onMissing: 'error' as OnMissingSetting },
		bounced: boolean = false,
	) {
		const currentIds: number[] = [];
		try {
			this.$('hyperlane').$$().forEach(lane => {
				currentIds.push(lane.$('to')._ as number);
			});
			
		}
		catch (_) {
			this.$('hyperlane')._ = [];
		}
		let hyperlanes = this.$('hyperlane')._ as ParadoxDataObject;
		systemList
			.map(idOrHandle => typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle)
			.filter(id => !(currentIds.includes(id)))
			.filter((value, index, array) => array.indexOf(value) === index)
			.forEach(id => {
				const system = this._save.findSystemById(id);
				if (!system) {
					switch (settings.onMissing) {
						case 'error':
							throw new MyError('system-not-found', `System not found by ID ${id} while adding hyperlanes.`);
						case 'warning':
							console.warn(`Warning: System not found by ID ${id} while adding hyperlanes.`);
							console.trace();
					}
					return;
				}
				const distance = Math.round(this.coords.distanceTo(system.coords));
				hyperlanes.push([null, [
					['to', id],
					['length', distance],
				]]);
				if (!bounced) {
					system.addHyperlanes([this.id], settings, true);
				}
			})
		;
		return this;
	}
	removeHyperlanes(
		systemList: (SystemHandle | number)[],
		settings = { onMissing: 'error' as OnMissingSetting },
		bounced: boolean = false,
	) {
		const denyIds = systemList
			.map(idOrHandle => typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle)
			.filter((value, index, array) => array.indexOf(value) === index)
		;
		const hyperlanes = this.$('hyperlane')._;
		if (Array.isArray(hyperlanes)) {
			const denyIndexes: number[] = [];
			hyperlanes.forEach((lane, index) => {
				const id = $(lane[1]).$('id')._ as number;
				if (denyIds.includes(id)) {
					denyIndexes.push(index);
					if (!bounced) {
						const system = this._save.findSystemById(id);
						if (!system) {
							switch (settings.onMissing) {
								case 'error':
									throw new MyError('system-not-found', `System not found by ID ${id} while removing hyperlanes.`);
								case 'warning':
									console.warn(`Warning: System not found by ID ${id} while removing hyperlanes.`);
									console.trace();
							}
							return;
						}
						system.removeHyperlanes([this.id], settings, true);
					}
				}
			})
			denyIndexes.forEach(index => {
				hyperlanes.splice(index, 1);
			})
		}
		return this;
	}
	removeAllHyperlanes(settings = { onMissing: 'error' as OnMissingSetting }) {
		this.$('hyperlane').$$().forEach(lane => {
			const id = lane.$('to')._ as number;
			const system = this._save.findSystemById(id);
			if (!system) {
				switch (settings.onMissing) {
					case 'error':
						throw new MyError('system-not-found', `System not found by ID ${id} while removing hyperlanes.`);
					case 'warning':
						console.warn(`Warning: System not found by ID ${id} while removing hyperlanes.`);
						console.trace();
				}
				return;
			}
			system.removeHyperlanes([this.id], settings, true);
		});
		this.$('hyperlane')._ = [];
		return this;
	}

	// TODO: neighbor systems

	////////////////////////////////////////////////////////////////////////////////

	get starbaseId() {
		return this.$('starbase')._ as number | undefined;
	}
	getStarbase() {
		return this.starbaseId == undefined ? undefined : this._save.getShipById(this.starbaseId);
	}
	setStarbase(idOrHandle: number | ShipHandle | undefined) {
		const id = idOrHandle instanceof ShipHandle ? idOrHandle.id : idOrHandle;
		this.$('starbase')._ = id;
	}

	////////////////////////////////////////////////////////////////////////////////

	get fleetsIds(): ReadonlyArray<number> {
		return this.$('fleet_presence').$$().map(e => e._ as number);
	}
	get fleets(): ReadonlyArray<FleetHandle> {
		return this.fleetsIds.map(id => this._save.getFleetById(id));
	}

	registerFleet(idOrHandle: number | FleetHandle) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('fleet_presence').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index === -1) {
			array.push([null, id]);
		}
	}
	unregisterFleet(idOrHandle: number | FleetHandle) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		const array = this.$('fleet_presence').valueAsObject();
		const index = array.findIndex(e => e[1] == id);
		if (index !== -1) {
			array.splice(index, 1);
		}
	}

	////////////////////////////////////////////////////////////////////////////////

	get planetIds(): ReadonlyArray<number> {
		return this.$$('planet').map(e => e._ as number);
	}
	get planets(): ReadonlyArray<PlanetHandle> {
		return this.planetIds.map(id => {
			const planet = this._save.findPlanetById(id);
			if (!planet) {
				throw new MyError('planet-not-found', `Planet not found by ID ${id} but specified in system ID ${this.id}.`);
			}
			return planet;
		});
	}

	// TODO: add/remove planets

	////////////////////////////////////////////////////////////////////////////////

	get sectorId() {
		return this.$('sector')._ as number;
	}
	getSector() {
		return this.sectorId === UndefinedSectorId ? undefined : this._save.getSectorById(this.sectorId);
	}
	setSector(idOrHandle: number | SectorHandle | undefined) {
		const id = idOrHandle instanceof SectorHandle ? idOrHandle.id : idOrHandle;
		this.$('sector')._ = id == undefined ? id : UndefinedSectorId;
	}

	////////////////////////////////////////////////////////////////////////////////

	remove() {
		// TODO: removing systems
		throw new MyError('not-implemented', `Removing systems not implemented yet.`)

		// Remove planets
		// Remove hyperlanes
		// Remove ambient objects
		// Remove fleets/ships
		// Update fleets/ships movements targets

		// Remove from gamestate structure
		{
			const array = this._save.gamestate.$('systems').valueAsObject();
			const index = array.findIndex(e => e[0] == this.id);
			if (index !== 1) {
				array.splice(index, 1);
			}
		}

		// Do something about event targets?
		// Do we need reorder systems before saving?
	}

	static async new(save: StellarisSave, coords?: CoordsHandle, starClass?: string, radius?: number, name?: string) {
		const id = getNewIdForNewSystem(save);
		coords ||= CoordsHandle.forNewObject(0, 0, GalaxyOrigin);
		starClass ||= ['sc_a', 'sc_b', 'sc_f'][Math.random() * 3 | 0]!;
		radius ||= 250;
		name ||= `System ID ${id}`
		console.debug(`Adding new system ID ${id} named '${name}' of class '${starClass}' and radius ${radius}`);

		// Prepare new system
		const object: ParadoxDataObject = [
			['coordinate', coords.value],
			['type', 'star'],
			['name', [
				['key', `"${name}"`],
			]],
			// ['planet', 123]
			['star_class', `"${starClass}"`],
			// ['hyperlane', []],
			// ['flags', []],
			// ['initializer', `"${initializer}"`],
			['inner_radius', radius],
			['outer_radius', radius + 100],
			['sector', GalaxyOrigin],

		];
		const entry: ParadoxDataEntry = [id, object];
		const handle = new SystemHandle(entry, save);

		// Register the system
		save.systems.push(handle);
		save.gamestate.$('galactic_object').valueAsObject().push(entry);

		return handle;
	}
}

export default SystemHandle;
