const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();
const target = 'pt';

async function translateText(text) {
  let [translations] = await translate.translate(text, target);
  translations = Array.isArray(translations) ? translations : [translations];
  return translations;
}

// module.exports = { translateText };
module.exports = translateText;