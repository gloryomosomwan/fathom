const { Translate } = require('@google-cloud/translate').v2;
const translate = new Translate();

async function translateText(text, target) {
  console.log('Target:', target);
  let [translations] = await translate.translate(text, target);
  translations = Array.isArray(translations) ? translations : [translations];
  return translations;
}

module.exports = translateText;