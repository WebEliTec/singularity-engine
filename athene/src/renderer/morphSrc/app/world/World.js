import WorldChild    from '../WorldChild.js';
import EntityClasses from './entityClasses/EntityClasses.js';

// World — the root of athene's domain tree, mirroring the conceptual
// model from notes/conceptual-deep-dive.md §2. The framing follows from
// what Singularity Engine actually is: a general-purpose domain modeling
// tool. The thing the user authors *is* a world — a set of EntityClasses
// (kinds of things), their relations, and their taxonomies. World is the
// noun for that root.
//
// Lives at `athene.world`. Athene is infrastructure (Apollo, navigation,
// runtime concerns); World is the domain (the model the user is shaping).
//
// World owns three top-level collections per the conceptual deep dive:
//
//   - entityClasses        — kinds of things in this world (I1)
//   - entityClassRelations — cross-class links (deferred, I4+)
//   - taxonomies           — categorization layers over EntityClasses (deferred, I4+)
//
// Iota I1 lands entityClasses only — enough to retire EntityClassManager
// and prove the WorldChild pattern. The other two arrive when their
// consumers earn their way in.

class World extends WorldChild {

  constructor( athene ) {
    super( athene );
    this.entityClasses = new EntityClasses( this );
    // entityClassRelations + taxonomies land at I4+ alongside their
    // sub-managers in the workbench. Left out for now rather than
    // stubbed as nulls — a layer is "anticipated" if the conceptual
    // model says it exists, regardless of whether the code yet does.
  }

}

export default World;
