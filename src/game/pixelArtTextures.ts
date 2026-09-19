// Deprecated: procedural painters moved to subject modules. This file is
// a compat barrel so older imports keep working — new code should import
// from src/game/textures/* or src/game/objects/* directly.
//
//   tiles / hunters / monsters / vfx  -> src/game/textures/*
//   buildings (1 file per type)       -> src/game/textures/buildings/*
//   yard props (chair/table/bed/...)  -> src/game/objects/*
//   iso canvas primitives             -> src/game/objects/iso.ts

export { createIsoTileTexture } from './textures/tiles';
export { createHunterFrame } from './textures/hunters';
export { createMonsterFrame } from './textures/monsters';
export { createSkillVfxTexture } from './textures/vfx';
export { createBuildingTexture } from './textures/buildings/index';
export {
  createChairTexture,
  createTableTexture,
  createBedTexture,
  createAnvilTexture,
  createVatTexture,
  createTrainingDummyTexture,
} from './objects';
