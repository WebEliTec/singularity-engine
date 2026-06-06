// The HTTP envelope — the public contract's outer shape, the same on every
// domain route (infrastructural routes like /health opt out).
//
//   success → { success: true,  data, message }
//   failure → { success: false, error: { code, message } }
//
// The error `code` (machine-readable) is distinct from `message` (human). The
// ApolloError type that carries them — and the status to render them with —
// lives in src/errors.js.

export function ok( data, message = null ) {
  return { success: true, data, message };
}

export function fail( code, message ) {
  return { success: false, error: { code, message } };
}
