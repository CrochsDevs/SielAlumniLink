// Keep operational exception details out of JSON responses, including legacy
// controllers that catch database/provider errors themselves.
export function protectApiResponses(_req, res, next) {
  res.setHeader('Cache-Control', 'private, no-store');
  const json = res.json;
  res.json = function (body) {
    return json.call(this, this.statusCode >= 500 ? {
      success: false, message: 'Unable to process this request. Please try again later.',
    } : body);
  };
  next();
}
