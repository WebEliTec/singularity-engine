// ApolloError — the cross-cutting error type, thrown by the domain and the
// HTTP layer alike and rendered to the failure envelope by server.js's error
// handler. Kept neutral (NOT under http/) so the domain can raise it without
// importing the HTTP layer — the dependency points the right way.
//
// It carries a stable machine-readable `code` plus the HTTP `statusCode` to
// render it with. The named constructors keep the two in lockstep.

export class ApolloError extends Error {
  constructor( statusCode, code, message ) {
    super( message );
    this.name       = 'ApolloError';
    this.statusCode = statusCode;
    this.code       = code;
  }

  static notFound( message )   { return new ApolloError( 404, 'not_found',        message ); }
  static validation( message ) { return new ApolloError( 400, 'validation_error', message ); }
  static conflict( message )   { return new ApolloError( 409, 'conflict',         message ); }
}
