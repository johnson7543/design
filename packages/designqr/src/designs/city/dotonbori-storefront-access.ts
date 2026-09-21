import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { DotonboriLibrary, DotonboriPolygon } from './dotonbori-assets.ts';
import type { DotonboriFront } from './dotonbori-facade-layout.ts';
import { DotonboriGeometry, DOTONBORI_PALETTE as P } from './dotonbori-geometry.ts';
import { dotonboriPoint } from './dotonbori-detail-layout.ts';
import { dotonboriPlanGeometry } from './dotonbori-morph.ts';
import { DOTONBORI_STOREFRONT_ACCESS } from './dotonbori-storefront-access-data.ts';

/** Forecourts fill only the datum gap between actual source walls and the
 * existing upper promenade. They retain the shop's source-building ownership. */
export function addDotonboriStorefrontAccess(b: DotonboriGeometry, front: DotonboriFront, library: DotonboriLibrary) {
  for (const access of DOTONBORI_STOREFRONT_ACCESS) {
    if (access.front !== front.id) continue;
    const polygon = access.polygon as unknown as DotonboriPolygon;
    b.add(dotonboriPlanGeometry([polygon], access.height / front.size, library.layout), P.stone);
    for (const [a, c] of access.edges) {
      const points = [dotonboriPoint(a[0], a[1], .02, library.layout), dotonboriPoint(c[0], c[1], .02, library.layout),
        dotonboriPoint(c[0], c[1], access.height, library.layout), dotonboriPoint(a[0], a[1], access.height, library.layout)];
      const side = new BufferGeometry();
      side.setAttribute('position', new Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(i => points[i].toArray()), 3));
      b.add(side, P.wall);
    }
  }
}
