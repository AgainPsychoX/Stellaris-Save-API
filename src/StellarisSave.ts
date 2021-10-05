import fs from 'fs/promises';
import path from 'path';
import { ParadoxDataEntry, ParadoxDataHelper, ParadoxDataObject, ParadoxDataObjectHandle } from "./utils/paradox";
import { precursorsFlags, SystemHandle } from './handles/SystemHandle';
import { SpeciesHandle } from './handles/SpeciesHandle';
import { CoordsPair, isCoordsPair } from './handles/CoordsHandle';
import { MyError, ParserError } from './utils/common';
import { PlanetHandle } from './handles/PlanetHandle';
import { NebulaHandle } from './handles/NebulaHandle';
import { LeaderHandle } from './handles/LeaderHandle';
import { getSafeTemporaryDirectory, packTemporaryFilesIntoSave, unpackSaveIntoTemporaryFiles } from './utils/packing';
import { CountryHandle } from '.';

export class StellarisSave {
	/**
	 * Path to temporary directory used in save unpacking and packing process.
	 */
	_tempDir: string | undefined;

	meta: ParadoxDataObjectHandle;
	gamestate: ParadoxDataObjectHandle;

	nebulas: NebulaHandle[];
	systems: SystemHandle[];
	planets: PlanetHandle[];
	countries: CountryHandle[];
	species: SpeciesHandle[];
	leaders: LeaderHandle[];

	constructor(
		meta: ParadoxDataEntry[],
		gamestate: ParadoxDataEntry[]
	) {
		this.meta = new ParadoxDataObjectHandle(meta);
		this.gamestate = new ParadoxDataObjectHandle(gamestate);

		this.nebulas = this.gamestate.$$('nebula')
			.map(e => new NebulaHandle(e))
		;
		this.systems = this.gamestate.$('galactic_object').$$()
			.map(e => new SystemHandle(e, this))
		;
		this.planets = this.gamestate.$('planets').$('planet').$$()
			.map(e => new PlanetHandle(e))
		;
		this.countries = this.gamestate.$('country').$$()
			.map(e => new CountryHandle(e, this))
		;
		this.species = (this.gamestate.$('species_db')._ as ParadoxDataObject)
			.map((e, i) => new SpeciesHandle(e[1] as ParadoxDataObject, i))
		;
		this.leaders = this.gamestate.$('leaders').$$()
			.map(e => new LeaderHandle(e))
		;
	}

	/**
	 * Loads saved game file.
	 * @param saveFilePath Path to save file to load.
	 * @param reportProgress Function to report progress (`step` out of `maxSteps`).
	 * @param reportMessage Function to update message (associated with progress).
	 * @returns `StellarisSave` object ready to work with.
	 */
	static async loadFromFile(
		saveFilePath: string, 
		reportProgress?: (step: number, maxSteps: number) => void, 
		reportMessage?: (message: string) => void
	) {
		if (reportProgress) {
			reportProgress(0, Infinity);
		}
		if (reportMessage) {
			reportMessage(`Decompressing save file...`);
		}
		const tempDir = await unpackSaveIntoTemporaryFiles(saveFilePath);
		
		if (reportMessage) {
			reportMessage(`Reading gamestate and meta files...`);
		}
		const metaFile = path.join(tempDir, 'meta');
		const gamestateFile = path.join(tempDir, 'gamestate');
		console.debug(`'meta' file path: ${metaFile}`);
		console.debug(`'gamestate' file path: ${gamestateFile}`);
		const metaString = await fs.readFile(metaFile, 'utf-8');
		const gamestateString = await fs.readFile(gamestateFile, 'utf-8');

		if (reportMessage) {
			reportMessage(`Parsing gamestate and meta...`);
		}
		const report = reportProgress ? (offset: number) => reportProgress(offset, gamestateString.length) : undefined;
		let metaParsed: ParadoxDataEntry[];
		let gamestateParsed: ParadoxDataEntry[];
		try {
			metaParsed = ParadoxDataHelper.loadFromString(metaString);
		}
		catch (error) {
			if (error instanceof ParserError) {
				error.path = metaFile;
			}
			throw error;
		}
		try {
			gamestateParsed = ParadoxDataHelper.loadFromString(gamestateString, report);
		}
		catch (error) {
			if (error instanceof ParserError) {
				error.path = gamestateFile;
			}
			throw error;
		}

		const save = new StellarisSave(metaParsed, gamestateParsed);
		save._tempDir = tempDir;
		return save;
	}

	/**
	 * Saves game state to file.
	 * @param saveFilePath Path to save file to.
	 * @param reportProgress Function to report progress (`step` out of `maxSteps`).
	 * @param reportMessage Function to update message (associated with progress).
	 */
	async saveToFile(
		saveFilePath: string,
		reportProgress?: (step: number, maxSteps: number) => void, 
		reportMessage?: (message: string) => void
	) {
		if (reportMessage) {
			reportMessage(`Saving gamestate and meta...`);
		}
		const metaString = ParadoxDataHelper.saveToString(this.meta._);
		const gamestateString = ParadoxDataHelper.saveToString(this.gamestate._);
		if (reportMessage) {
			reportMessage(`Saving gamestate and meta files...`);
		}
		if (!this._tempDir) {
			this._tempDir = await getSafeTemporaryDirectory();
		}
		await fs.writeFile(path.join(this._tempDir, 'meta'), metaString, 'utf-8');
		await fs.writeFile(path.join(this._tempDir, 'gamestate'), gamestateString, 'utf-8');
		if (reportMessage) {
			reportMessage(`Compressing files into save file...`);
		}
		await packTemporaryFilesIntoSave(saveFilePath, this._tempDir);
	}

	////////////////////////////////////////////////////////////////////////////////

	get name() {
		return this.gamestate.$('name')._ as string;
	}
	set name(value: string) {
		this.gamestate.$('name')._ = value;
	}

	get version() {
		return this.gamestate.$('version')._ as string;
	}

	get date() {
		return this.gamestate.$('date')._ as string;
	}

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds Nebula by name.
	 * 
	 * Warning! Although rarely, there might be multiple nebulas 
	 * with the same name, in that case, only one will be returned.
	 */
	findNebulaByName(name: number) {
		return this.nebulas.find(n => n.name === `"${name}"`);
	}

	/**
	 * Finds Nebula by system which is contained by the nebula.
	 * 
	 * Warning! Although rarely, there might be multiple nebulas 
	 * containing the same system, in that case, only one will be returned.
	 */
	findNebulaBySystem(idOrHandle: number | SystemHandle) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		return this.nebulas.find(n => n.systemIds.includes(id));
	}

	/**
	 * Finds system by ID.
	 */
	findSystemById(id: number) {
		// We assume they cannot be removed or reordered.
		return this.systems[id];
	}

	/**
	 * Finds system by name.
	 * 
	 * Warning! There might be multiple systems with the same name, 
	 * in that case, only one will be returned.
	 */
	findSystemByName(name: string) {
		return this.systems.find(s => s.name === `"${name}"`);
	}

	/**
	 * Gets system handle by ID, handle (pass) or name.
	 * If can't find, throws error.
	 */
	getSystem(idOrHandleOrName: number | SystemHandle | string) {
		if (typeof idOrHandleOrName === 'number') {
			const system = this.findSystemById(idOrHandleOrName);
			if (!system) {
				throw new MyError('system-not-found', `System not found by ID ${idOrHandleOrName}`);
			}
			return system;
		}
		else if (idOrHandleOrName instanceof SystemHandle) {
			return idOrHandleOrName;
		}
		else {
			const system = this.findSystemByName(idOrHandleOrName);
			if (!system) {
				throw new MyError('system-not-found', `System not found by name ${idOrHandleOrName}`);
			}
			return system;
		}
	}

	/**
	 * Finds systems closest to provided coords or system.
	 * 
	 * If system selected, the system is omitted. If no `requiredCount` will
	 * be provided, all systems will be returned, just sorted by distance.
	 */
	findSystemsClosestTo(coordsOrOtherSystem: CoordsPair | SystemHandle | number, requiredCount?: number) {
		let systemsSortedClosest;
		if (isCoordsPair(coordsOrOtherSystem)) {
			systemsSortedClosest = this.systems
				.map(s => [s, s.coords.distanceTo(coordsOrOtherSystem)] as const)
				.sort((a, b) => a[1] - b[1])
			;
		}
		else {
			const system = typeof coordsOrOtherSystem === 'number' ? 
				this.findSystemById(coordsOrOtherSystem) : coordsOrOtherSystem;
			if (!system) {
				throw new MyError('system-not-found', `System not found by ID ${coordsOrOtherSystem}.`);
			}
			const coords = system.coords;
			systemsSortedClosest = this.systems
				.filter(s => s.id != system.id)
				.map(s => [s, s.coords.distanceTo(coords)] as const)
				.sort((a, b) => a[1] - b[1])
			;
		}

		if (requiredCount) {
			systemsSortedClosest.splice(requiredCount);
		}

		return systemsSortedClosest.map(a => a[0]);
	}

	/**
	 * Finds planet by ID.
	 */
	findPlanetById(id: number) {
		// We assume they cannot be removed or reordered.
		return this.planets[id];
	}

	/**
	 * Finds species by species index, as they don't have normal IDs
	 * for some reason.
	 */
	findSpeciesByIndex(index: number) {
		return this.species[index];
	}

	/**
	 * Finds species by name.
	 * 
	 * Warning! There might be multiple species with the same name, 
	 * in that case, only one will be returned.
	 */
	findSpeciesByName(name: string) {
		return this.species.find(s => s.name === `"${name}"`);
	}

	////////////////////////////////////////////////////////////////////////////////

	swapTwoStarSystems(
		a: SystemHandle | number, 
		b: SystemHandle | number, 
		settings?: { preservePrecursors?: boolean }
	) {
		settings ??= {};
		settings.preservePrecursors ??= true;

		const aSystem = this.getSystem(a);
		const bSystem = this.getSystem(b);
		const aId = aSystem.id;
		const bId = bSystem.id;

		const aSystemNeighboursIds = aSystem.$('hyperlane').$$().map(e => e.$('to')._ as number);
		const bSystemNeighboursIds = bSystem.$('hyperlane').$$().map(e => e.$('to')._ as number);
		const aHyperlanes = (aSystem.$('hyperlane')._ || []) as ParadoxDataObject;
		const bHyperlanes = (bSystem.$('hyperlane')._ || []) as ParadoxDataObject;
		aSystem.$('hyperlane')._ = bHyperlanes;
		bSystem.$('hyperlane')._ = aHyperlanes;

		aSystemNeighboursIds.forEach(id => {
			this.getSystem(id).$('hyperlane').$$().forEach(lane => {
				const toEntry = lane.$('to')._entry;
				if (toEntry[1] === aId) {
					toEntry[1] = bId;
				}
				// Handle direct neighbours
				else if (toEntry[1] === bId) {
					toEntry[1] = aId;
				}
			});
		});
		bSystemNeighboursIds.forEach(id => {
			this.getSystem(id).$('hyperlane').$$().forEach(lane => {
				const toEntry = lane.$('to')._entry;
				if (toEntry[1] === bId) {
					toEntry[1] = aId;
				}
				// Handle direct neighbours
				else if (toEntry[1] === aId) {
					toEntry[1] = bId;
				}
			});
		});
		
		const aSystemCoords = aSystem.$('coordinate')._;
		const bSystemCoords = bSystem.$('coordinate')._;
		aSystem.$('coordinate')._ = bSystemCoords;
		bSystem.$('coordinate')._ = aSystemCoords;

		const aNebula = this.findNebulaBySystem(aSystem);
		const bNebula = this.findNebulaBySystem(bSystem);
		if (aNebula != bNebula) {
			if (aNebula) {
				aNebula.removeSystem(aSystem);
				aNebula.addSystem(bSystem);
			}
			if (bNebula) {
				bNebula.removeSystem(bSystem);
				bNebula.addSystem(aSystem);
			}
		}
		// TODO: move nebulas background too - ambient_object filtered by 'nebula' string in 'data' field?

		if (settings.preservePrecursors) {
			precursorsFlags.forEach(flag => {
				const tmp = !!(aSystem.flags[flag]);
				aSystem.flags[flag] = !!(bSystem.flags[flag]);
				bSystem.flags[flag] = tmp;
			});
		}
	}
}

export default StellarisSave;
