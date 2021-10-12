import { ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle } from "@/utils/paradox";

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

export class CoordsHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	static forNewObject(x?: number, y?: number, origin?: number) {
		const instance = new CoordsHandle([]);
		if (typeof x === 'undefined' || typeof y === 'undefined') {
			return instance;
		}
		instance.x = x;
		instance.y = y;
		if (typeof origin === 'undefined') {
			instance.origin = 4294967295;
		}
		else {
			instance.origin = origin;
		}
		return instance;
	}

	get x() {
		return this.$('x').value as number;
	}
	get y() {
		return this.$('y').value as number;
	}
	get origin() {
		return this.$('origin').value as number;
	}

	set x(value: number) {
		this.$('x').value = value;
	}
	set y(value: number) {
		this.$('y').value = value;
	}
	set origin(value: number) {
		this.$('origin').value = value;
	}

	distanceTo(otherOrStruct: CoordsPair) {
		const x = this.x - otherOrStruct.x;
		const y = this.y - otherOrStruct.y;
		return Math.sqrt((x * x) + (y * y));
	}

	// X+ == left; Y+ == down
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
