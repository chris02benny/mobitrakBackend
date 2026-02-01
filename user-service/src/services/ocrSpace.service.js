const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const extractTextFromImage = async (imageUrl) => {
    try {
        const apiKey = process.env.OCR_SPACE_API_KEY;
        if (!apiKey) {
            throw new Error('OCR_SPACE_API_KEY is not defined in environment variables');
        }

        console.log(`[OCR Service] Starting extraction for image: ${imageUrl}`);

        // OCR.space API endpoint
        const apiUrl = 'https://api.ocr.space/parse/image';

        // Prepare request parameters
        const params = new URLSearchParams();
        params.append('apikey', apiKey);
        params.append('url', imageUrl); // Image URL from Cloudinary
        params.append('language', 'eng'); // English
        params.append('isOverlayRequired', 'false'); // Just text
        params.append('OCREngine', '2'); // Use Engine 2 for better accuracy
        params.append('scale', 'true'); // Auto-scale
        params.append('detectOrientation', 'true');

        // Send POST request
        const response = await axios.post(apiUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const data = response.data;

        // Check for API-level errors
        if (data.IsErroredOnProcessing) {
            throw new Error(`OCR API Error: ${data.ErrorMessage || 'Unknown error'}`);
        }

        if (!data.ParsedResults || !Array.isArray(data.ParsedResults) || data.ParsedResults.length === 0) {
            throw new Error('OCR API returned no results.');
        }

        const result = data.ParsedResults[0];

        // Check for specific error message in parsed results
        if (result.ErrorMessage) {
            throw new Error(`OCR Parsed Error: ${result.ErrorMessage}`);
        }

        const extractedText = result.ParsedText;

        // Handle empty text
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('OCR extraction successful but returned empty text.');
        }

        const cleanText = extractedText.trim();

        console.log(`[OCR Service] Successfully extracted ${cleanText.length} characters.`);

        // Return result as single string
        return cleanText;

    } catch (error) {
        console.error('[OCR Service] Error:', error.message);
        // Throwing error to be handled by controller
        throw error;
    }
};

module.exports = {
    extractTextFromImage
};
