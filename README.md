
# Stellaris Save API

This package provides simple work-in-progress API to modify Stellaris save files, as well as command line interface tool to make use of it.

Note: the save structure can change between Stellaris versions, so the API provided by this package might be inaccurate.

Currently working version: `Cepheus v3.4.5`.





## Features

### Library

+ Properly unpacking and packing the save.
+ Parsing Paradox data structures into Javascript accessible bundle.
+ Handle classes/types that proxy to the data structure, allowing easier usage.
+ Utility tools (i.e. swapping systems, moving systems, etc.).
+ Loading game data (for scripting or referencing).
+ Report creating tools (precursor maps, stats of fallen empires, origins, ethics, traits, etc.).


### Command line interface

After installing, the `ssa-cli` will be accessible to allow some tasks without writing your own scripts. Use `ssa-cli [sub-command] --help` for options listing.

#### Commands

+ `interactive` - interactive Javascript REPL with access to save object.
+ `list` - listing games/saves.
+ `pack`/`unpack` - packing/unpacking the save files.
+ `precursors` - generating in-game map of precursors systems (see source or use `debugtoolip` to inspect "colors").
+ `report` - reporting some stuff about countries (WIP).





## Installing

No releases will be provided, at least now. Installable NPM package will be provided in future.

### Contributing mode

1. Install [Node](https://nodejs.org/en/download/) (LTS should be fine) and `7-Zip`. Make sure they are accessible via `PATH` environment variable.
2. Clone the repository, then navigate with command prompt to the project root directory.
3. Use `npm install` to install dependencies.
4. Run it (multiple options):
	1. You can use `npm run cli:ts` to run it as Typescript (`ts-node` mode), passing params should look like: `npm run cli:ts --- --help`.
	2. You can compile it (to JavaScript) by running `npm run build` once, then you can use `npm run cli:js` in similar fashion as above.
5. <sub><sup>(Optional)</sup></sub> Use `npm link` (with admin privileges) to make the tool available as `ssa-cli --help`.




## Todo

There is a lot of missing functionalities, but base handles allow to easy enough navigation and accessing any structures of the saved game. Then, on top of those base handles, more specialized handles are created, like `SystemHandle` for example.

#### Commands

- `list` (add metadata viewing to listing),
- `editor` (unpack, open editor, pack after closed or file modified (`--watch` mode)),
- `report` (a lot more stuff to add, use better cli structure),
- `play` (start the save file in the game; see how launcher does it),

#### Handles

A lot of stuff still missing from higher abstraction handles, here are just examples.

- `PopHandle` (and relation for species and planet),
- `BuildingHandle` (and relation for planet),
- `PlanetHandle` (to name a few: moons, districts, armies, modifiers, expiable flags, stats...),
- `CountryHandle` (flag, technologies, resources, events (it might be especially difficult, the same for anomalies, event chains, archeology), vision, AI relations, policies, armies, intel, modifiers, flags, variables, traditions, perks, relics, edicts...),
- ...

#### Reports

- ~~ethics,~~
- ~~origins,~~
- ~~personalities,~~
- ~~governments authorities,~~
- ~~civics,~~
- habitability (empires, species, planets)
- fallen empires,
- star classes,
- planet classes,
- initializers,
- species,
- traits (species, leaders),
- detect empire/species names collisions,
- detect species portraits collisions,

#### Other

- Since 3.3 or 3.4 names of almost all objects can use variables and stuff. Need to refactor all 'name' getters/setters. Maybe create `NameHandle` with all features and conversion to string, and allow setting simply `string`. For now, only key part of name is used as name string.
- allow direct save input/output to/from unpacked state?
- game data handles/structures could be useful (like `ComponentTemplate`).
- optimize game save? (remove empty/none values, remove unused designs?, ...),
- bird script (creating bird out of systems and hyperlanes between them),
- fleet analysis tool (generating map to test fleets designs and compositions),
- create tests, especially to detect save structure changes to allow smoother updates in future.
- try using [Deno](https://deno.land/manual@v1.23.2/node) for even easier execution,
- find a pattern for commander.js to use with multiple loggers or for filtering logs




