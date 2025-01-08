const axios = require('axios');

const translateText = async (text, targetLang) => {
  const apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY';
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const response = await axios.post(url, {
    q: text,
    target: targetLang,
  });
  return response.data.data.translations[0].translatedText;
};

module.exports = { translateText };
