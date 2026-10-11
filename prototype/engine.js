/** Local visual prototype. Points have no monetary value. */
import { ART } from './symbols.js?v=20261011-entry16';
export const SYMBOLS = Object.freeze(ART.map(item => item.id));

const SIDE = 4;
const CELL_COUNT = SIDE * SIDE;
const MIN_GROUP = 3;
const POINTS_PER_SYMBOL = 10;

/** Return a new flat, row-major 4×4 board. rng must return values in [0, 1). */
export function createGrid(rng = Math.random) {
  if (typeof rng !== 'function') throw new TypeError('rng must be a function');
  return Array.from({ length: CELL_COUNT }, () => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('rng must return a finite number in [0, 1)');
    }
    return SYMBOLS[Math.floor(value * SYMBOLS.length)];
  });
}

/** Evaluate maximal orthogonally connected components without mutating the board. */
export function evaluateGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== CELL_COUNT) {
    throw new TypeError('grid must be a flat array of 16 symbol ids');
  }
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!SYMBOLS.includes(grid[index])) {
      throw new TypeError(`Invalid symbol at index ${index}`);
    }
  }

  const visited = new Set();
  const groups = [];
  for (let start = 0; start < CELL_COUNT; start += 1) {
    if (visited.has(start)) continue;
    const symbol = grid[start];
    const pending = [start];
    const indices = [];
    visited.add(start);

    while (pending.length) {
      const index = pending.pop();
      indices.push(index);
      const row = Math.floor(index / SIDE);
      const column = index % SIDE;
      const neighbors = [];
      if (row > 0) neighbors.push(index - SIDE);
      if (row < SIDE - 1) neighbors.push(index + SIDE);
      if (column > 0) neighbors.push(index - 1);
      if (column < SIDE - 1) neighbors.push(index + 1);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && grid[neighbor] === symbol) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }

    if (indices.length >= MIN_GROUP) {
      indices.sort((a, b) => a - b);
      groups.push({ symbol, indices, size: indices.length, points: indices.length * POINTS_PER_SYMBOL });
    }
  }

  return {
    groups,
    winningIndices: groups.flatMap(group => group.indices).sort((a, b) => a - b),
    totalPoints: groups.reduce((sum, group) => sum + group.points, 0),
    hasWin: groups.length > 0,
  };
}

/** Deterministic examples for visual review; never random or hidden outcomes. */
export function scriptedGrid(kind = 'win') {
  const grid = Array.from({ length: CELL_COUNT }, (_, index) =>
    ['scarab', 'brooch', 'shawl', 'rifle'][(Math.floor(index / SIDE) + index % SIDE) % 4]);
  const examples = {
    lose: [],
    win: [0, 1, 2],
    line: [0, 1, 2],
    square: [0, 1, 4, 5],
    rectangle: [0, 1, 2, 4, 5, 6],
  };
  if (!Object.hasOwn(examples, kind)) throw new RangeError(`Unknown scripted grid: ${kind}`);
  for (const index of examples[kind]) grid[index] = 'ring';
  return grid;
}

/** Remove winners and compact each column downward, preserving survivor order. */
export function collapseGrid(grid, winningIndices, rng = Math.random) {
 const removed = new Set(winningIndices);
 const fresh = createGrid(rng);
 const next = Array(CELL_COUNT), origins = Array(CELL_COUNT);
 for (let column=0; column<SIDE; column++) {
  const survivors=[];
  for(let row=0; row<SIDE; row++) {
   const index=row*SIDE+column;
   if(!removed.has(index))survivors.push({symbol:grid[index],row});
  }
  const missing=SIDE-survivors.length;
  for(let row=0; row<SIDE; row++) {
   const index=row*SIDE+column;
   if(row<missing){next[index]=fresh[index];origins[index]=row-missing;}
   else {const survivor=survivors[row-missing];next[index]=survivor.symbol;origins[index]=survivor.row;}
  }
 }
 return {grid:next,origins};
}
