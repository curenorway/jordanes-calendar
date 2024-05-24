const fetch = require('node-fetch');
const cron = require('cron');
require('dotenv').config();

const webflowApiKey = process.env.WEBFLOW_API_KEY;
const collectionId = process.env.COLLECTION_ID;

console.log('Starting Webflow CMS sync script...');
console.log('WEBFLOW_API_KEY:', webflowApiKey);
console.log('COLLECTION_ID:', collectionId);

// Function to get the current timestamp in milliseconds
function getCurrentTimestamp() {
  return Date.now();
}

// Function to fetch data from Oslo Børs
async function fetchOsloBorsData() {
  const currentTimestamp = getCurrentTimestamp();
  const osloBorsEndpoint = `https://ir.oms.no/server/secure/components?auth=key%3dJORDA&product=financialCalendar&start=${currentTimestamp}`;

  console.log('Fetching Oslo Børs data from:', osloBorsEndpoint);

  try {
    const response = await fetch(osloBorsEndpoint);
    const data = await response.json();
    console.log('Oslo Børs response:', data); // Log the entire response
    if (!data || !data.rows) {
      console.log('No data.rows found in Oslo Børs response');
      return [];
    }
    return data.rows;
  } catch (error) {
    console.error('Error fetching Oslo Børs data:', error);
    return [];
  }
}

// Function to get existing items in Webflow CMS collection
async function getWebflowItems() {
  const url = `https://api.webflow.com/v2/collections/${collectionId}/items`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${webflowApiKey}`
    }
  };

  console.log('Fetching Webflow items from URL:', url);

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log('Webflow response:', data); // Log the entire response
    if (!data || !data.items) {
      console.log('No items found in Webflow response');
      return [];
    }
    return data.items;
  } catch (error) {
    console.error('Error fetching Webflow items:', error);
    return [];
  }
}

// Function to create a slug
function createSlug(text) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  console.log('Creating slug:', text, '->', slug);
  return slug;
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
async function updateWebflowCollection(data) {
  const existingItems = await getWebflowItems();
  if (!existingItems) {
    console.error('Failed to fetch existing Webflow items.');
    return;
  }
  console.log('Existing Webflow items:', existingItems);

  for (const row of data) {
    console.log('Processing row:', row);

    const existingItem = existingItems.find(item => item.fields.key === row.key);
    const name = `${row.values.CALENDAR_EVENT_HEADING} - ${row.values.CALENDAR_EVENT_DATE}`;
    const slug = createSlug(name);
    const formattedDate = formatDate(row.values.CALENDAR_EVENT_DATE);

    const itemData = {
      fields: {
        'key': row.key,
        'ticker': row.values.TICKER,
        'sector': row.values.OSE_ITEM_SECTOR,
        'event_url': row.values.CALENDAR_EVENT_URL,
        'event_date': formattedDate,
        'event_heading': row.values.CALENDAR_EVENT_HEADING,
        'name': name,
        'slug': slug
      }
    };

    console.log('Item data to be sent:', itemData);

    const url = existingItem
      ? `https://api.webflow.com/v2/collections/${collectionId}/items/${existingItem._id}`
      : `https://api.webflow.com/v2/collections/${collectionId}/items`;

    const options = {
      method: existingItem ? 'PUT' : 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${webflowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fieldData: itemData.fields })
    };

    try {
      console.log(`Sending ${existingItem ? 'update' : 'create'} request for item:`, itemData);
      const response = await fetch(url, options);
      const result = await response.json();
      console.log(`Item ${existingItem ? 'updated' : 'created'} successfully:`, result);
    } catch (error) {
      console.error(`Error ${existingItem ? 'updating' : 'creating'} item:`, error);
    }
  }
}

// Function to sync data
async function syncData() {
  console.log('Starting data sync...');
  const data = await fetchOsloBorsData();
  if (data && data.length > 0) {
    console.log('Data fetched from Oslo Børs:', data);
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
