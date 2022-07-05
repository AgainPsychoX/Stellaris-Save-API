import { structuredClone } from "@/utils/common";
import { ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle } from "@/utils/paradox";

/**
 * Special origin for objects in galaxy view, typically used by systems.
 */
export const GalaxyOrigin = 4294967295;

export interface CoordsPair {
	x: number;
	y: number
}
export const isCoordsPair = (object: any): object is CoordsPair => {
	return (
		typeof (object as CoordsPair).x === 'number' &&
		typeof (object as CoordsPair).y === 'number'
	)
}

export interface CoordsData extends CoordsPair {
	origin: number;
}
const hasAlsoOrigin = (object: CoordsPair): object is CoordsData => {
	return typeof (object as CoordsData).origin === 'number';
}

export class CoordsHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataObjectHandle | ParadoxDataEntryHandle) {
		super(object);
	}

	copy() {
		return new CoordsHandle(structuredClone(this._object));
	}

	static forNewObject(x?: number | CoordsPair | CoordsData, y?: number, origin?: number) {
		const instance = new CoordsHandle([]);

		if (isCoordsPair(x)) {
			instance.x = x.x;
			instance.y = x.y;
			instance.origin = hasAlsoOrigin(x) ? x.origin : GalaxyOrigin;
			return instance;
		}

		if (x === undefined || y === undefined) {
			// might cause error down the road if not initialized by user
			return instance;
		}

		instance.x = x;
		instance.y = y;
		instance.origin = origin === undefined ? GalaxyOrigin : origin;
		return instance;
	}

	/**
	 * X coordinate of object (planet, ship, system).
	 * 
	 * Rising means moving left for the screen viewpoint.
	 */
	get x() {
		return this.$('x').value as number;
	}
	set x(value: number) {
		this.$('x').value = value;
	}

	get screenX() {
		return 400 - this.x;
	}
	set screenX(value: number) {
		this.x = 400 - value;
	}

	/**
	 * Y coordinate of object (planet, ship, system).
	 * 
	 * Rising means moving down for the screen viewpoint.
	 */
	get y() {
		return this.$('y').value as number;
	}
	set y(value: number) {
		this.$('y').value = value;
	}

	get screenY() {
		return this.y + 400;
	}
	set screenY(value: number) {
		this.y = value - 400;
	}

	/**
	 * Origin of the coordinates. Can be system ID or `GalaxyOrigin`.
	 */
	get origin() {
		return this.$('origin').value as number;
	}
	set origin(value: number) {
		this.$('origin').value = value;
	}

	distanceTo(otherOrStruct: CoordsPair) {
		const x = this.x - otherOrStruct.x;
		const y = this.y - otherOrStruct.y;
		return Math.sqrt((x * x) + (y * y));
	}

	setRelativeTo(other: CoordsPair, offsetX: number, offsetY: number) {
		this.x = other.x + offsetX || 0;
		this.y = other.y + offsetY || 0;
	}

	static circleCenterForPoints(A: CoordsData, B: CoordsData, C: CoordsData)
	{
		const yDelta_a = B.y - A.y;
		const xDelta_a = B.x - A.x;
		const yDelta_b = C.y - B.y;
		const xDelta_b = C.x - B.x;

		const aSlope = yDelta_a / xDelta_a;
		const bSlope = yDelta_b / xDelta_b;

		const x = (aSlope*bSlope*(A.y - C.y) + bSlope*(A.x + B.x) - aSlope*(B.x+C.x) )/(2* (bSlope-aSlope) );
		const y = -1*(x - (A.x+B.x)/2)/aSlope +  (A.y+B.y)/2;

		return CoordsHandle.forNewObject(x, y, A.origin);
	}

	static averageForPoints(...points: CoordsData[]): CoordsHandle;
	static averageForPoints(first: CoordsData, ...points: CoordsPair[]): CoordsHandle {
		let sumX = first.x;
		let sumY = first.y;
		for (const point of points) {
			sumX += point.x;
			sumY += point.y;
		}
		const count = 1 + points.length;
		return CoordsHandle.forNewObject(sumX / count, sumY / count, first.origin);
	}
}

export default CoordsHandle;
