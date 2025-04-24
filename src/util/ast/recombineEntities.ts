// TODO DELETE ME

// import type { ApiMessageEntity } from '../../api/types';

// export const recombineEntities = (entities?: ApiMessageEntity[]): ApiMessageEntity[] => {
//   if (!entities) {
//     return [];
//   }

//   if (entities.length < 2) {
//     return entities;
//   }

//   const recombinedEntities: ApiMessageEntity[] = [];

//   // Ensure that entities are sorted by offset
//   entities.sort((a, b) => (a.offset > b.offset ? 1 : -1));

//   // These indexes are going to be included in previous entities
//   const indexesToSkip = new Set<number>();

//   let i = 0;

//   while (i < entities.length) {
//     if (indexesToSkip.has(i)) {
//       i++;
//       continue;
//     }

//     const entity = entities[i];
//     let length = entity.length;

//     let j = i + 1;
//     while (j < entities.length) {
//       const nextEntity = entities[j];
//       if (entity.type !== nextEntity.type) {
//         j++;
//         continue; // continue j cycle
//       }
//       if (entity.offset + length === nextEntity.offset) {
//         // Recombine, add length, push index to skip
//         length += nextEntity.length;
//         indexesToSkip.add(j);
//         j++;
//         continue; // continue j cycle
//       } else {
//         break; // break j cycle
//       }
//     }

//     recombinedEntities.push({
//       ...entity,
//       length,
//     });
//     i++;
//   }

//   return recombinedEntities;
// };

// export const getEntityIndexesToRecombine = (entities: ApiMessageEntity[]): number[] => {
//   if (!entities) {
//     return [];
//   }

//   if (entities.length < 2) {
//     return [];
//   }

//   const indexesToRecombine: number[] = [];

//   // Ensure that entities are sorted by offset
//   entities.sort((a, b) => (a.offset > b.offset ? 1 : -1));

//   // These indexes are going to be included in previous entities
//   const indexPairsToRecombine = new Set<[number, number]>();

//   let i = 0;

//   while (i < entities.length) {
//     if (indexPairsToRecombine.has(i)) {
//       i++;
//       continue;
//     }

//     const entity = entities[i];
//     let length = entity.length;

//     let j = i + 1;
//     while (j < entities.length) {
//       const nextEntity = entities[j];
//       if (entity.type !== nextEntity.type) {
//         j++;
//         continue; // continue j cycle
//       }
//       if (entity.offset + length === nextEntity.offset) {
//         // Recombine, add length, push index to skip
//         length += nextEntity.length;
//         indexPairsToRecombine.add(j);
//         j++;
//         continue; // continue j cycle
//       } else {
//         break; // break j cycle
//       }
//     }

//     indexesToRecombine.push({
//       ...entity,
//       length,
//     });
//     i++;
//   }

//   return indexesToRecombine;
// };
