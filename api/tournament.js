
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      // 1. Fetch data from Vercel KV
      const data = await kv.get('hastmacup_data');

      // Return data or null (client handles defaults)
      return response.status(200).json(data || null);
    }

    else if (request.method === 'POST') {
      const newData = request.body;

      if (!newData) {
        return response.status(400).json({ error: 'No data provided' });
      }

      // 2. Save to KV
      // Set timestamp
      if (newData.metadata) {
        newData.metadata.lastUpdated = new Date().toISOString();
      }

      await kv.set('hastmacup_data', newData);

      return response.status(200).json({ success: true, timestamp: newData.metadata?.lastUpdated });
    }

    else {
      return response.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
