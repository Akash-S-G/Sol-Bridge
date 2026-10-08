const { errorResponse } = require('../utils/response');

/**
 * Express middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} target - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    if (!schema) {
      return next();
    }

    const dataToValidate = req[target] || {};
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const details = {};
      error.details.forEach((err) => {
        const key = err.path.join('.') || 'request';
        details[key] = err.message.replace(/['"]/g, '');
      });

      return res
        .status(400)
        .json(errorResponse('ValidationError', 'Validation failed', 400, details));
    }

    // Replace request target with sanitized and converted values
    req[target] = value;
    return next();
  };
};

module.exports = { validate };

