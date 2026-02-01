const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * AI-based extraction service for Indian RC Books using LLM
 * Uses structured prompts for accurate field extraction
 */

const extractRCFieldsWithAI = async (ocrText) => {
    try {
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

        if (!apiKey) {
            console.warn('[AI Extraction] No API key found, falling back to regex parsing');
            return null;
        }

        const prompt = `You are a document extraction engine specialized in Indian Vehicle Registration Certificates (RC Book – Kerala RTO format).

Your task is to extract ONLY the exact field values requested.

CRITICAL RULES:
1. Extract ONLY the value, NEVER include the field label/name
2. Stop immediately when you see another field label
3. Do NOT include newlines unless the value genuinely spans multiple lines
4. If you see a field label in the extracted value, you made a mistake - remove it
5. Return null if you cannot find the value

IMPORTANT FIELD RULES:

• regnNo (Registration Number):
  - Pattern: 2 letters + 2 digits + 1–2 letters + 4 digits
  - Example: "KL-05-AK-1233"

• makersName (Maker Name):
  - Manufacturer company name ONLY
  - Example: "ASHOK LEYLAND LTD"
  - STOP before "Name of Regd", "Dealer", etc.

• ownerName:
  - Person name ONLY
  - Do NOT include S/o, D/o, W/o or what comes after
  - Example: "THOMAS THOMAS"

• address (Permanent Address):
  - Look for "Permanent Address" field specifically
  - Do NOT use hypothecation/bank address or "Details of Hypothecation" address
  - Join address lines until you see "Temporary Address", "WEF", or date patterns
  - STOP before "WEF. DD.MM.YYYY", "Temporary Address", or any dates
  - Example: "VELLAPLAMURIYIL KARIKKATTOOR CENTRE P.O MANIMALA KOTTAYAM"

• chassisNo (Chassis Number):
  - Alphanumeric value ONLY, usually 17 characters
  - Example: "MB1PBEFC9EEXN2953"

• bodyType (Type of Body):
  - One word: SALOON, SUV, BUS, TRUCK, etc.

• seatingCapacity:
  - Look for the exact field "Seating Capacity" on the right side of RC
  - Integer ONLY (usually 2-100)
  - Do NOT confuse with weight, power, or other numeric fields
  - Example: "50"

• colour:
  - Look for "Colour" field
  - May contain multiple colors separated by commas
  - Example: "WHITE,GREEN,RED,YELLOW BLUE"
  - Keep all colors as listed

• taxUpto:
  - Look for "Paid from: DD/MM/YYYY to DD/MM/YYYY" pattern
  - Extract the END date (the "to" date)
  - Format: DD/MM/YYYY
  - Example: If you see "Paid from: 01/01/2019 to 31/03/2019", return "31/03/2019"

• monthYearOfMfg (Month & Year of Manufacture):
  - Look for "Month of mnfr" and "Year of mnfr" fields
  - Combine them as "Month YYYY"
  - Example: "Jun 2014"

• vehicleClass (Class of Vehicle):
  - Example: "HMPV-Cong.Carr", "LMV", "HMV"

• engineNo (Engine Number):
  - Alphanumeric only
  - Example: "EYHZ411746"

• fuelUsed (Fuel Type):
  - One word: PETROL, DIESEL, CNG, ELECTRIC

• dateOfRegn (Date of Registration):
  - Format: DD/MM/YYYY

• regnValidity, dateOfEffect:
  - Format: DD/MM/YYYY or null

RAW OCR TEXT:
"""
${ocrText}
"""

Return ONLY a JSON object. NO explanations. NO field labels in values.

{
  "regnNo": "",
  "dateOfRegn": "",
  "regnValidity": "",
  "chassisNo": "",
  "engineNo": "",
  "ownerName": "",
  "fatherSpouseName": "",
  "address": "",
  "taxUpto": "",
  "fuelUsed": "",
  "dateOfEffect": "",
  "vehicleClass": "",
  "makersName": "",
  "dealerName": "",
  "colour": "",
  "bodyType": "",
  "seatingCapacity": "",
  "monthYearOfMfg": "",
  "vehicleDescription": ""
}`;

        console.log('[RC AI Extraction] Sending request to AI service...');

        // Using OpenAI API format (compatible with OpenRouter and other providers)
        const apiUrl = process.env.AI_API_URL || process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
        const model = process.env.AI_MODEL || 'openai/gpt-4o-mini';

        const response = await axios.post(
            apiUrl,
            {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a specialized document extraction engine. Return only valid JSON, no explanations.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        console.log('[AI Extraction] Received response from AI');

        // Parse JSON response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI response did not contain valid JSON');
        }

        const extractedData = JSON.parse(jsonMatch[0]);
        console.log('[AI Extraction] Successfully parsed extracted data');

        // Post-process to clean up any field labels or contamination
        const cleanedData = {};
        const fieldLabelsToRemove = [
            'Chassis Number', 'Engine Number', 'Name of Regd', 'Dealer',
            'Type of Body', 'Seating Capacity', 'Permanent Address',
            'Details of Tax', 'Tax Licence', 'Amount', 'Paid from',
            'Temporary Address'
        ];

        for (const [key, value] of Object.entries(extractedData)) {
            if (!value || value === null) {
                cleanedData[key] = '';
                continue;
            }

            let cleaned = String(value);

            // Remove field labels
            for (const label of fieldLabelsToRemove) {
                cleaned = cleaned.replace(new RegExp(`\\n?${label}.*$`, 'i'), '');
                cleaned = cleaned.replace(new RegExp(`^${label}\\s*`, 'i'), '');
            }

            // Special cleanup for address - remove WEF dates
            if (key === 'address') {
                cleaned = cleaned.replace(/\s*WEF\.?\s*\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}.*$/i, '');
                cleaned = cleaned.replace(/\s*Temporary Address.*$/i, '');
            }

            // Clean up excessive newlines for single-value fields
            if (['ownerName', 'makersName', 'bodyType', 'colour', 'fuelUsed',
                'seatingCapacity', 'vehicleClass', 'chassisNo', 'engineNo'].includes(key)) {
                cleaned = cleaned.split('\n')[0].trim(); // Take only first line
            }

            // Trim whitespace
            cleaned = cleaned.trim();

            cleanedData[key] = cleaned;
        }

        console.log('[AI Extraction] Cleaned extracted data:', JSON.stringify(cleanedData, null, 2));

        return cleanedData;

    } catch (error) {
        console.error('[AI Extraction] Error:', error.message);

        // Return null to fall back to regex parsing
        return null;
    }
};

module.exports = {
    extractRCFieldsWithAI
};
