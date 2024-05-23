const axios = require('axios');
const Webflow = require('webflow-api'); // Import the Webflow API
const cron = require('cron');
require('dotenv').config();

const webflow = new Webflow({ token: process.env.WEBFLOW_API_TOKEN });
const collectionId = process.env.COLLECTION_ID;

// Function to get the current timestamp in milliseconds
function getCurrentTimestamp() {
  return Date.now();
}

// Function to fetch data from Oslo Børs
async function fetchOsloBorsData() {
  const currentTimestamp = getCurrentTimestamp();
  const osloBorsEndpoint = `https://ir.oms.no/server/secure/components?auth=key%3dJORDA&product=financialCalendar&start=${currentTimestamp}`;

  try {
    const response = await axios.get(osloBorsEndpoint);
    return response.data.rows;
  } catch (error) {
    console.error('Error fetching Oslo Børs data:', error);
  }
}

// Function to get existing items in Webflow CMS collection
async function getWebflowItems() {
  try {
    const { items } = await webflow.items({ collectionId });
    return items;
  } catch (error) {
    console.error('Error fetching Webflow items:', error);
  }
}

// Function to create a slug
function createSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// Function to update Webflow CMS collection
async function updateWebflowCollection(data) {
  const existingItems = await getWebflowItems();

  // Check and update existing items or create new ones
  for (const row of data) {
    const existingItem = existingItems.find(item => item.fields.key === row.key);
    const name = `${row.values.CALENDAR_EVENT_HEADING} - ${row.values.CALENDAR_EVENT_DATE}`;
    const slug = createSlug(name);

    const itemData = {
      key: row.key,
      ticker: row.values.TICKER,
      sector: row.values.OSE_ITEM_SECTOR,
      event_url: row.values.CALENDAR_EVENT_URL,
      event_date: row.values.CALENDAR_EVENT_DATE,
      event_heading: row.values.CALENDAR_EVENT_HEADING,
      name: name,
      slug: slug
    };

    if (existingItem) {
      await webflow.updateItem({
        collectionId,
        itemId: existingItem._id,
        fields: itemData,
      });
    } else {
      await webflow.createItem({
        collectionId,
        fields: itemData,
      });
    }
  }
}

// Function to sync data
async function syncData() {
  const data = await fetchOsloBorsData();
  if (data) {
    await updateWebflowCollection(data);
  }
}

// Schedule the sync to run every hour
const job = new cron.CronJob('0 * * * *', syncData);
job.start();

console.log('Webflow CMS sync server is running...');
