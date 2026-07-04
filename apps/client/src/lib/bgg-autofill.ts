import type { BggCatalogHitDto } from '@tabletop/shared';

/** The subset of the add-game form that a catalog hit can populate. */
export interface AutofillPatch {
  title: string;
  releaseYear: string;
  bggId: number;
  imagePath: string | null;
}

export function hitToFormPatch(hit: BggCatalogHitDto): AutofillPatch {
  return {
    title: hit.name,
    releaseYear: hit.year === null ? '' : String(hit.year),
    bggId: hit.bggId,
    imagePath: hit.thumbnail,
  };
}
