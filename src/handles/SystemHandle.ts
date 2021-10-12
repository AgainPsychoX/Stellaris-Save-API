import { $, ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, stripSidesByCharacter } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import { MyError } from "@/utils/common";
import { CoordsHandle } from "./CoordsHandle";
import { PlanetHandle } from "..";
import SectorHandle, { UndefinedSectorId } from "./SectorHandle";


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
		this.$('star_class')._ = `"${value}""`;
	}

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
	
	// TODO: add/remove planets
}

export default SystemHandle;
