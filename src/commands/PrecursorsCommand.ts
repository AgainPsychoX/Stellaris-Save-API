import { Command } from 'commander';
import { table } from 'table';
import StellarisSave from '@/StellarisSave';
import { addSaveFileInputHandlingToCommand, addSaveFileOutputHandlingToCommand, loadSaveFileFancy, saveSaveFileFancy } from './common';
import { PrecursorFlag, precursorsFlags, precursorFlagToName } from '@/handles/SystemHandle';

const paintPrecursors = (
	save: StellarisSave,
	settings: {
		only?: PrecursorFlag[],
		colors?: {
			default?: string,
			conflict?: string;
			/** Star class to paint with for Vultaum precursor systems */
			precursor_1?: string,
			/** Star class to paint with for Yuht precursor systems */
			precursor_2?: string,
			/** Star class to paint with for First League precursor systems */
			precursor_3?: string,
			/** Star class to paint with for Irassian precursor systems */
			precursor_4?: string,
			/** Star class to paint with for Cybrex precursor systems */
			precursor_5?: string,
			precursor_zroni_1?: string,
			precursor_baol_1?: string,
		},
	} = {}
) => {
	settings ||= {};
	settings.colors = Object.assign({
		default: "sc_black_hole",
		conflict: "sc_trinary_1",
		precursor_1: "sc_f",
		precursor_2: "sc_a",
		precursor_3: "sc_g",
		precursor_4: "sc_m_giant",
		precursor_5: "sc_b",
		precursor_zroni_1: "sc_neutron_star",
		precursor_baol_1: "sc_pulsar",
	}, settings.colors);
	if (settings.only) {
		for (const flag of precursorsFlags) {
			if (!settings.only.includes(flag)) {
				settings.colors[flag] = settings.colors.default;
			}
		}
	}
	const stats = Object.fromEntries(
		(['empty', 'conflict'].concat(precursorsFlags)).map(f => [f, 0] as const)
	) as Record<'empty' | 'conflict' | PrecursorFlag, number>;
	for (const system of save.systems) {
		let anything = false;
		for (const flag of precursorsFlags) {
			if (system.flags[flag]) {
				stats[flag] += 1;
				if (anything) {
					stats['conflict'] += 1;
					system.starClass = settings.colors.conflict!;
					break;
				}
				system.starClass = settings.colors![flag]!;
				anything = true;
			}
		}
		if (!anything) {
			stats['empty'] += 1;
			system.starClass = settings.colors.default!;
		}
	}
	return stats;
}

export const registerPrecursorsCommand = (parent: Command) => {
	const that = parent
		.command('precursors')
		.alias('precursor')
		.description('creates precursors map by marking systems types in game')
		.action(async (options) => {
			const save = await loadSaveFileFancy(options.input);
			const sorted = Object.entries(paintPrecursors(save))
				.sort(([_, a], [__, b])  => b - a)
				.map(([flag, count]) => [flag, precursorFlagToName[flag as PrecursorFlag] || '', count])
			;
			sorted.unshift(['Flag', 'Name', 'Count']);
			console.log(table(sorted, { drawHorizontalLine: (i, c) => (i < 2 || i == c) }));
			await saveSaveFileFancy(options.output, save);
		})
	;
	addSaveFileInputHandlingToCommand(that);
	addSaveFileOutputHandlingToCommand(that);
	return that;
}

export default registerPrecursorsCommand;
