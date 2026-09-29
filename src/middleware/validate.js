// Wraps a Zod schema into middleware. Usage:
//   router.post('/x', validate(schema), controller)
// Keeps validation logic out of controllers entirely — a controller
// can trust that by the time it runs, req.body already matches the schema.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    req.body = result.body ?? req.body;
    req.params = result.params ?? req.params;
    // Express 5 makes req.query a getter-only property, so plain assignment
    // throws. Redefine it on the instance instead.
    if (result.query) {
      Object.defineProperty(req, "query", {
        value: result.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}
