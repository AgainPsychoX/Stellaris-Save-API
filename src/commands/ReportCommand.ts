import { Command, Option } from 'commander';
import { table } from 'table';
import { loadGameData } from '@/utils/gameData';
import { ParadoxDataObjectHandle } from '@/utils/paradox';
import { addSaveFileInputHandlingToCommand, loadSaveFileFancy } from './common';

export const registerReportCommand = (parent: Command) => {
	const that = parent
		.command('report')
		.description('creates some reports from data in saved game')
		.addOption(new Option('--show-all-vanilla').hideHelp())
		.action(async (options) => {
			const save = await loadSaveFileFancy(options.input);

			const topics = ['countries'];
			// TODO: more stuff and better code structure

			if (topics.includes('countries')) {
				const stuff = ['personality', 'ethos', 'governmentType', 'civics', 'origin'] as const;
				type Stuff = typeof stuff[number];
				const counts = Object.fromEntries(stuff.map(a => [a, {}])) as Record<Stuff, Record<string, number>>;

				const data: any[][] = [['Name', 'Personality', 'Ethos', 'Government type', 'Civics', 'Origin', 'Start system ID']];
				for (const country of save.countries.filter(c => ['default', 'fallen_empire'].includes(c.type))) {
					const personality = country.personality as string;
					const ethos = country.ethos;
					const governmentType = country.governmentType as string;
					const civics = country.civics;
					const origin = country.origin as string;

					// Push new line for countries table
					data.push([
						country.name, 
						personality, 
						ethos.join('\n'), 
						governmentType, 
						civics.join('\n'), 
						origin, 
						country.startingSystemId
					]);

					// Zero counters if undefined
					counts['personality'][personality] ||= 0;
					for (const ethic of ethos) {
						counts['ethos'][ethic] ||= 0;
					}
					counts['governmentType'][governmentType] ||= 0;
					for (const civic of civics) {
						counts['civics'][civic] ||= 0;
					}
					counts['origin'][origin] ||= 0;

					// Increment counters
					counts['personality'][personality] += 1;
					for (const ethic of ethos) {
						counts['ethos'][ethic] += 1;
					}
					counts['governmentType'][governmentType] += 1;
					for (const civic of civics) {
						counts['civics'][civic] += 1;
					}
					counts['origin'][origin] += 1;
				}

				console.log(table(data));

				if (options.showAllVanilla) {
					const personalitiesData = await loadGameData('common/personalities/*', { critical: false });
					for (const personality of personalitiesData.map(e => e[0] as string)) {
						counts['personality'][personality] ||= 0;
					}

					const governmentsData = await loadGameData('common/governments/*', { critical: false });
					for (const governmentType of governmentsData.map(e => e[0] as string)) {
						counts['governmentType'][governmentType] ||= 0;
					}

					const civicsAndOrigins = new ParadoxDataObjectHandle(await loadGameData('common/governments/civics/*', { critical: false }));
					for (const civicOrOrigin of civicsAndOrigins.$$()) {
						if ((civicOrOrigin.$('is_origin')._ as string) == 'yes') {
							counts['origin'][civicOrOrigin.key as string] ||= 0;
						}
						else {
							counts['civics'][civicOrOrigin.key as string] ||= 0;
						}
					}
				}

				for (const thing of stuff.filter(a => !['ethos'].includes(a))) {
					const thingData = Object.entries(counts[thing]).sort(([_, a], [__, b]) => b - a) as any[][];
					thingData.unshift([thing.charAt(0).toUpperCase() + thing.slice(1), 'Count']);
					console.log(table(thingData, { drawHorizontalLine: (i, c) => (i < 2 || i == c) }));
				}

				const axisEthics = [
					['xenophile', 'xenophobe'],
					['pacifist', 'militarist'], 
					['egalitarian', 'authoritarian'], 
					['materialist', 'spiritualist'],
				].map(([a, b]) => [`ethic_fanatic_${a}`, `ethic_${a}`, `ethic_${b}`, `ethic_fanatic_${b}`] as const);

				const vanillaEthics = axisEthics.flat().concat(['ethic_gestalt_consciousness']) as string[];
				const saveEthics = Object.keys(counts['ethos']);
				const unknownEthics = saveEthics.filter(e => !vanillaEthics.includes(e));
				if (unknownEthics.length > 0) {
					const unknownEthicsData = unknownEthics.map(e => [e, counts['ethos'][e]]);
					unknownEthicsData.unshift(['Unknown ethics', 'Count']);
					console.log(table(unknownEthicsData));
				}

				const ethosTableData: any[][] = [
					['Ethos', 'Count', 'Ethos', 'Count', 'Ethos', 'Count', 'Ethos', 'Count'],
					...axisEthics.map(a => a.flatMap(e => [e, counts['ethos'][e] || 0])),
					['ethic_gestalt_consciousness', counts['ethos']['ethic_gestalt_consciousness'], '', '', '', '', '', ''],
				];

				console.log(table(ethosTableData));
			}
		})
	;
	addSaveFileInputHandlingToCommand(that);
	return that;
}

export default registerReportCommand;
