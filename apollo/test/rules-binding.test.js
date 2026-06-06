// R4 — the binding test. Asserts the three tiers of the INVARIANTS layer of the
// canonical model version are in bijection BY ID:
//   Tier 1  ../../model/versions/<v>/invariants.formal.md   (canonical)
//   Tier 2  ../../model/versions/<v>/invariants.md          (prose)
//   Tier 3  ../src/domain/rules/index.js                    (the registry)
// and that each rule's enforcement STYLE matches whether it binds a predicate.
//
// It reads UP into the sibling `model/` directory (apollo implements a spec it
// does not own). If that directory is absent — apollo checked out standalone —
// the test SKIPS rather than fails, so apollo stays independently testable.
// CANONICAL_VERSION is pinned to the highest committed model version — bump it
// when a newer version is committed.
//
// Run: `npm test` (node --test).

import test     from 'node:test';
import assert   from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path     from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULE_REGISTRY, NON_INVARIANTS } from '../src/domain/rules/index.js';

const HERE              = path.dirname( fileURLToPath( import.meta.url ) );
const CANONICAL_VERSION = 'v1';   // the highest committed model version (the canonical model)
const MODEL_DIR         = path.resolve( HERE, '..', '..', 'model', 'versions', CANONICAL_VERSION );

async function readOrNull( file ) {
  try { return await readFile( file, 'utf8' ); }
  catch ( err ) { if ( err.code === 'ENOENT' ) return null; throw err; }
}

// Every `### R-…`/`### N-…` markdown header is a rule (or non-invariant) entry.
function idsIn( md ) {
  const re  = /^###\s+(R-[A-Z]+-\d+|N-[A-Z]+-\d+)\b/gm;
  const ids = new Set();
  let m;
  while ( ( m = re.exec( md ) ) ) ids.add( m[ 1 ] );
  return ids;
}
const sorted = set => [ ...set ].sort();
const filterPrefix = ( set, p ) => new Set( [ ...set ].filter( id => id.startsWith( p ) ) );

test( 'R4 — rule tiers are in bijection by id', async ( t ) => {
  const formal = await readOrNull( path.join( MODEL_DIR, 'invariants.formal.md' ) );
  const prose  = await readOrNull( path.join( MODEL_DIR, 'invariants.md' ) );
  if ( formal === null || prose === null ) {
    t.skip( 'model/ directory absent (apollo standalone) — binding test skipped' );
    return;
  }

  const registryRules = new Set( Object.keys( RULE_REGISTRY ) );
  const registryNon   = new Set( NON_INVARIANTS );

  const formalIds = idsIn( formal );
  const proseIds  = idsIn( prose );

  // Tier 1 ↔ registry, Tier 2 ↔ registry (rules + non-invariants, both directions).
  assert.deepEqual( sorted( filterPrefix( formalIds, 'R-' ) ), sorted( registryRules ), 'Tier-1 rules ↔ registry' );
  assert.deepEqual( sorted( filterPrefix( proseIds,  'R-' ) ), sorted( registryRules ), 'Tier-2 rules ↔ registry' );
  assert.deepEqual( sorted( filterPrefix( formalIds, 'N-' ) ), sorted( registryNon ),   'Tier-1 non-invariants ↔ registry' );
  assert.deepEqual( sorted( filterPrefix( proseIds,  'N-' ) ), sorted( registryNon ),   'Tier-2 non-invariants ↔ registry' );
} );

test( 'R4 — enforcement style matches predicate binding', () => {
  for ( const [ id, r ] of Object.entries( RULE_REGISTRY ) ) {
    if ( r.style === 'predicate' || r.style === 'derivation' ) {
      assert.equal( typeof r.predicate, 'function', `${ id } (${ r.style }) must bind a predicate` );
    } else {
      assert.equal( r.predicate, null, `${ id } (${ r.style }) must not bind a predicate` );
    }
  }
} );
