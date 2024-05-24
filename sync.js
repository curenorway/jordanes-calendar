const fetch = require('node-fetch');
const cron = require('cron');
require('dotenv').config();

const webflowApiKey = process.env.WEBFLOW_API_KEY;
const collectionId = process.env.COLLECTION_ID;

console.log('Starting Webflow CMS sync script...');

// Function to get the current timestamp in milliseconds
function getCurrentTimestamp() {
  return Date.now();
}

// Function to fetch data from Oslo Børs
async function fetchOsloBorsData() {
  const currentTimestamp = getCurrentTimestamp();
  const osloBorsEndpoint = `https://ir.oms.no/server/secure/components?auth=key%3dJORDA&product=financialCalendar&start=${currentTimestamp}`;

  try {
    const response = await fetch(osloBorsEndpoint);
    const data = await response.json();
    console.log('Fetched Oslo Børs data');
    return data.rows || [];
  } catch (error) {
    console.error('Error fetching Oslo Børs data:', error);
    return [];
  }
}

// Function to get existing items in Webflow CMS collection
async function getWebflowItems() {
  const url = `https://api.webflow.com/v2/collections/${collectionId}/items?limit=100`;
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
    console.log(`Fetched ${data.items.length} items from Webflow`);
    console.log('Full Webflow response:', JSON.stringify(data, null, 2)); // Log the entire response
    return data.items || [];
  } catch (error) {
    console.error('Error fetching Webflow items:', error);
    return [];
  }
}

// Function to create a slug
function createSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// Function to format date to ISO 8601
function formatDate(dateString) {
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return date.toISOString();
}

// Function to update Webflow CMS collection
async function updateWebflowCollection(data, isDraft = true, isPublished = false) {
  const existingItems = await getWebflowItems();
  const existingItemsMap = new Map();
  existingItems.forEach(item => {
    if (item.fieldData && item.fieldData.key) {
      const key = item.fieldData.key.toLowerCase();
      existingItemsMap.set(key, item);
      console.log(`Stored existing item key: ${key}`); // Log each key being stored
    } else {
      console.log('Item missing key field:', item); // Log any items missing the key field
    }
  });

  console.log('Existing Webflow item keys:', Array.from(existingItemsMap.keys())); // Log all stored keys

  const itemsToUpdate = [];
  const itemsToCreate = [];

  data.forEach(row => {
    const key = row.key.toLowerCase(); // Convert incoming keys to lowercase for case-insensitive comparison
    const existingItem = existingItemsMap.get(key);
    console.log(`Processing Oslo Børs item key: ${key}`); // Log the key being processed

    const name = `${row.values.CALENDAR_EVENT_HEADING} - ${row.values.CALENDAR_EVENT_DATE}`;
    const slug = createSlug(name);
    const formattedDate = formatDate(row.values.CALENDAR_EVENT_DATE);

    const itemData = {
      'key': row.key,
      'ticker': row.values.TICKER,
      'sector': row.values.OSE_ITEM_SECTOR,
      'event-url': row.values.CALENDAR_EVENT_URL,
      'event-date': formattedDate,
      'event-heading': row.values.CALENDAR_EVENT_HEADING,
      'name': name,
      'slug': slug
    };

    if (existingItem) {
      console.log(`Match found for key: ${key}, updating item.`);
      itemsToUpdate.push({ existingItem, itemData });
    } else {
      console.log(`No match for key: ${key}, creating new item.`);
      itemsToCreate.push(itemData);
    }
  });

  console.log(`Items to update: ${itemsToUpdate.length}, Items to create: ${itemsToCreate.length}`);

  for (const { existingItem, itemData } of itemsToUpdate) {
    const url = `https://api.webflow.com/v2/collections/${collectionId}/items/${existingItem._id}`;
    const options = {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fieldData: itemData, // Correct field name
        isDraft: isDraft,
        isArchived: false,
        isPublished: isPublished
      })
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (result.message) {
        console.error(`Error updating item: ${result.message}`);
      } else {
        console.log(`Item updated successfully: ${itemData.key}`);
      }
    } catch (error) {
      console.error('Error updating item:', error);
    }
  }

  for (const itemData of itemsToCreate) {
    const url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fieldData: itemData, // Correct field name
        isDraft: isDraft,
        isArchived: false,
        isPublished: isPublished
      })
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (result.message) {
        console.error(`Error creating item: ${result.message}`);
      } else {
        console.log(`Item created successfully: ${itemData.key}`);
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  }
}

// Function to sync data
async function syncData() {
  console.log('Starting data sync...');
  const data = await fetchOsloBorsData();
  if (data.length > 0) {
    console.log(`Fetched ${data.length} items from Oslo Børs`);
    await updateWebflowCollection(data);
  } else {
    console.log('No data fetched from Oslo Børs.');
  }
  console.log('Data sync completed.');
}

// Schedule the sync to run every hour
const job = new cron.CronJob('0 * * * *', syncData);
job.start();

console.log('Webflow CMS sync server is running...');

// Call syncData immediately for debugging
syncData();
