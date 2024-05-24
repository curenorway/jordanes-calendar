const fetch = require('node-fetch');
require('dotenv').config();

const webflowApiKey = process.env.WEBFLOW_API_KEY;
const collectionId = process.env.COLLECTION_ID;

const url = `https://api.webflow.com/v2/collections/${collectionId}`;
const options = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        authorization: `Bearer ${webflowApiKey}`
    }
};

fetch(url, options)
    .then(res => res.json())
    .then(json => console.log(JSON.stringify(json, null, 2)))
    .catch(err => console.error('error:' + err));
