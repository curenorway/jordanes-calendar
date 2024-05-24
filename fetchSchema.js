const fetch = require('node-fetch');
require('dotenv').config();

const webflowApiKey = process.env.WEBFLOW_API_KEY;
const collectionId = process.env.COLLECTION_ID;

async function fetchCollectionSchema() {
    const url = `https://api.webflow.com/collections/${collectionId}`;
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            authorization: `Bearer ${webflowApiKey}`
        }
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log('Collection schema:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error fetching collection schema:', error);
    }
}

fetchCollectionSchema();
