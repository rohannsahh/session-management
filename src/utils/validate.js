const Joi = require("joi");

const preferencesSchema = Joi.object({
  theme: Joi.string().valid("dark", "light").required().default("light"),
  notifications: Joi.string().valid("enabled", "disabled").required().default("enabled"),
  language: Joi.string().required().default("English"),
});

module.exports = preferencesSchema;