import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      // Get all predictions
      const predictions = await kv.get('hastma_pickem_predictions') || [];
      return response.status(200).json(predictions);
    }

    else if (request.method === 'POST') {
      const predictionData = request.body;

      if (!predictionData || !predictionData.winner) {
        return response.status(400).json({ error: 'Invalid prediction data' });
      }

      // Get existing predictions
      const existingPredictions = await kv.get('hastma_pickem_predictions') || [];
      
      // Add new prediction
      existingPredictions.push({
        ...predictionData,
        serverTimestamp: new Date().toISOString()
      });

      // Save back to KV
      await kv.set('hastma_pickem_predictions', existingPredictions);

      return response.status(200).json({ 
        success: true, 
        totalPredictions: existingPredictions.length 
      });
    }

    else if (request.method === 'DELETE') {
      // Clear all predictions (for admin use)
      await kv.set('hastma_pickem_predictions', []);
      return response.status(200).json({ success: true, message: 'All predictions cleared' });
    }

    else {
      return response.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Predictions API Error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
