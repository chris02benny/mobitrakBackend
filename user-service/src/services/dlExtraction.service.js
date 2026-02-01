const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * AI-based extraction service for Indian Driving Licenses using LLM
 * Uses structured prompts for accurate field extraction
 */

const extractDLFieldsWithAI = async (ocrText) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

    if (!apiKey) {
      console.warn('[DL AI Extraction] No API key found, falling back to regex parsing');
      return null;
    }

    const prompt = `You are a document extraction engine specialized in Indian Driving Licenses.
You will receive text extracted from the FRONT and BACK of a driving license.

Your task is to extract ONLY the exact field values requested.

DATA SOURCE GUIDANCE:
- Look for "DL No", "License No", names, dates, and address primarily in the FRONT text.
- Look for "COV", "Class of Vehicle", "LMV", "MCWG", "TRANS", "NT" or table-like structures primarily in the BACK text.

CRITICAL RULES:
1. Extract ONLY the value, NEVER include the field label/name
2. Stop immediately when you see another field label
3. Do NOT include newlines unless the value genuinely spans multiple lines
4. If you see a field label in the extracted value, you made a mistake - remove it
5. Return null if you cannot find the value

IMPORTANT FIELD RULES:

• licenseNumber (DL Number):
  - Pattern: 2 letters (state code) + 2 digits (RTO code) + 4 digits (year) + 7 digits (unique number)
  - Example: "KL0520140001234"
  - Look for "DL No", "License No"
  - Ignore spaces in the number if possible to match standard format (e.g., KL05 20140001234 -> KL0520140001234)

• name (Full Name):
  - Person name ONLY
  - Do NOT include S/o, D/o, W/o or what comes after
  - Example: "RAJESH KUMAR"

• fatherSpouseName (S/o, D/o, W/o):
  - Extract the name after S/o, D/o, or W/o
  - Example: "KUMAR SHARMA"

• dob (Date of Birth):
  - Format: DD-MM-YYYY or DD/MM/YYYY
  - Example: "15-05-1990"

• address (Permanent Address):
  - Full address as listed (House name, PO, City, Pin)
  - Join address lines until you see another field like "Present Address"
  - Example: "123 MAIN STREET KOCHI KERALA 682001"

• bloodGroup:
  - Example: "O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"

• issueDate (Date of Issue):
  - Format: DD-MM-YYYY or DD/MM/YYYY
  - Look for "Date of Issue", "Issue Date"
  - If multiple dates exist, prefer the one near "Issue Date" label.

• validUpto (Valid Till):
  - Format: DD-MM-YYYY or DD/MM/YYYY
  - FIRST CHECK FRONT IMAGE TEXT for "Validity (NT)", "Validity ( NT )", "Valid Upto", "Valid Till"
  - Look for patterns like:
    * "Validity (NT)" followed by a date (with or without spaces, colon, or dash)
    * "Validity ( NT )" followed by a date
    * "Valid Upto : DD-MM-YYYY"
    * "Valid Till : DD-MM-YYYY"
  - The date may appear on the same line or the next line after "Validity (NT)"
  - If found in FRONT text, use that date
  - If not found in FRONT, check BACK text for NT validity
  - Non-Transport (NT) validity is usually on the FRONT image
  - Examples:
    * Input: "Validity (NT)\n12-06-2042" → Extract: "12-06-2042"
    * Input: "Validity ( NT ) 15-08-2045" → Extract: "15-08-2045"
    * Input: "Valid Upto : 20-12-2048" → Extract: "20-12-2048"

• vehicleClasses (COV - Class of Vehicle):
  - List of vehicle classes separated by commas.
  - LOOK IN THE BACK IMAGE TEXT.
  - Common codes: LMV (Light Motor Vehicle), MCWG (Motorcycle with Gear), HGMV, HPMV.
  - Example extraction: "MCWG, LMV"

RAW OCR TEXT:
"""
${ocrText}
"""

Return ONLY a JSON object. NO explanations. NO field labels in values.

{
  "licenseNumber": "",
  "name": "",
  "fatherSpouseName": "",
  "dob": "",
  "address": "",
  "bloodGroup": "",
  "issueDate": "",
  "validUpto": "",
  "vehicleClasses": ""
}`;

    console.log('[DL AI Extraction] Sending request to AI service...');

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
    console.log('[DL AI Extraction] Received response from AI');

    // Parse JSON response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    console.log('[DL AI Extraction] Successfully parsed extracted data');

    // Post-process to clean up any field labels or contamination
    const cleanedData = {};
    const fieldLabelsToRemove = [
      'License Number', 'DL No', 'Name', 'S/o', 'D/o', 'W/o',
      'Date of Birth', 'DOB', 'Address', 'Blood Group', 'BG',
      'Date of Issue', 'DOI', 'Valid Till', 'Valid Upto', 'COV',
      'Validity', 'Validity (NT)', 'Validity (TR)', 'Badge No', 'Badge Date',
      'Permanent Address', 'Present Address'
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
        cleaned = cleaned.replace(new RegExp(`^${label}\\s*:?\\s*`, 'i'), '');
      }

      // Clean up excessive newlines for single-value fields
      if (['name', 'fatherSpouseName', 'bloodGroup', 'licenseNumber',
        'dob', 'issueDate', 'validUpto', 'vehicleClasses'].includes(key)) {
        cleaned = cleaned.split('\n')[0].trim(); // Take only first line
      }

      // Remove leading/trailing dots and commas
      cleaned = cleaned.replace(/^[.\s,]+|[.\s,]+$/g, '');

      // Clean up address field specifically
      if (key === 'address') {
        // Remove stray dots that appear alone or at the start
        cleaned = cleaned.replace(/^\s*\.\s*/g, ''); // Leading dot
        cleaned = cleaned.replace(/\.\s*\.+/g, '.'); // Multiple consecutive dots
        cleaned = cleaned.replace(/\s+\.\s+/g, ' '); // Dot surrounded by spaces (replace with space)
        cleaned = cleaned.replace(/\.([A-Z])/g, ' $1'); // Dot before capital letter without space
        cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces to single space
        cleaned = cleaned.trim();
      }

      // Clean up license number - remove spaces
      if (key === 'licenseNumber') {
        cleaned = cleaned.replace(/\s+/g, '');
      }

      // Standardize date formats to DD-MM-YYYY
      if (['dob', 'issueDate', 'validUpto'].includes(key)) {
        cleaned = cleaned.replace(/\//g, '-');
      }

      // Normalize name fields - remove extra spaces and proper case
      if (['name', 'fatherSpouseName', 'ownerName'].includes(key)) {
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
      }

      // Trim whitespace
      cleaned = cleaned.trim();

      cleanedData[key] = cleaned;
    }

    console.log('[DL AI Extraction] Cleaned extracted data:', JSON.stringify(cleanedData, null, 2));

    return cleanedData;

  } catch (error) {
    console.error('[DL AI Extraction] Error:', error.message);

    // Return null to fall back to regex parsing
    return null;
  }
};

/**
 * Regex-based extraction fallback for Indian Driving Licenses
 * Used when AI service is unavailable
 */
const extractDLFieldsWithRegex = (ocrText) => {
  console.log('[DL Regex Extraction] Starting regex-based extraction...');

  const extractedData = {
    licenseNumber: '',
    name: '',
    fatherSpouseName: '',
    dob: '',
    address: '',
    bloodGroup: '',
    issueDate: '',
    validUpto: '',
    vehicleClasses: ''
  };

  try {
    // STEP 1: Extract DL Number first (e.g., KL05 2021 0002344 or KL0520210002344)
    const dlNoMatch = ocrText.match(/(?:DL\s*No\.?\s*[:\-]?\s*)?([A-Z]{2}\s*\d{2}\s*\d{4}\s*\d{7})/i);
    if (dlNoMatch) {
      extractedData.licenseNumber = dlNoMatch[1].replace(/\s+/g, '');
    }

    // STEP 2: Extract Date of Birth FIRST (before other dates) - try multiple patterns
    let dobMatch = ocrText.match(/Date\s+of\s+Birth[:\-\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    if (!dobMatch) {
      dobMatch = ocrText.match(/DOB[:\-\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    }
    if (dobMatch) {
      extractedData.dob = dobMatch[1].replace(/\//g, '-');
    }

    // STEP 3: Extract Issue Date - try multiple patterns
    // Pattern 1: "Issue Date 05-02-2021" or "05-02-2021" near "Issue"
    let issueDateMatch = ocrText.match(/Issue\s*Date[:\-\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    if (!issueDateMatch) {
      // Pattern 2: Just the date after "Issue" keyword
      issueDateMatch = ocrText.match(/Issue[^\d]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    }
    if (issueDateMatch) {
      extractedData.issueDate = issueDateMatch[1].replace(/\//g, '-');
    }

    // STEP 4: Extract Validity - Check FRONT text first (NT validity usually on front)
    // Split the OCR text to separate FRONT and BACK
    const frontTextMatch = ocrText.match(/FRONT:\s*([\s\S]*?)(?=BACK:|$)/i);
    const frontText = frontTextMatch ? frontTextMatch[1] : ocrText;
    const backTextMatch = ocrText.match(/BACK:\s*([\s\S]*)/i);
    const backText = backTextMatch ? backTextMatch[1] : '';

    let validityMatch = null;

    // PRIORITY 1: Look for Validity (NT) specifically in FRONT text (most common location)
    // Handle variations: "Validity (NT)", "Validity ( NT )", with or without colon/dash
    // Date may be on same line or next line
    validityMatch = frontText.match(/Validity\s*\(\s*NT\s*\)\s*[:\-]?\s*[\n]?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    
    // PRIORITY 2: Look for Valid Upto / Valid Till in FRONT text (but NOT near DOB label)
    if (!validityMatch) {
      // Make sure it's not the DOB by checking it's not near "Birth" keyword
      const validUptoMatches = frontText.matchAll(/Valid\s*(?:Upto|Till)\s*[:\-]?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/gi);
      for (const match of validUptoMatches) {
        const surroundingText = frontText.substring(Math.max(0, match.index - 50), Math.min(frontText.length, match.index + 50));
        // Skip if this is near "Birth" or "DOB" keywords
        if (!/Birth|DOB/i.test(surroundingText)) {
          validityMatch = match;
          break;
        }
      }
    }
    
    // PRIORITY 3: Look for generic Validity in FRONT text (but exclude DOB context)
    if (!validityMatch) {
      const validityMatches = frontText.matchAll(/Validity\s*[:\-]?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/gi);
      for (const match of validityMatches) {
        const surroundingText = frontText.substring(Math.max(0, match.index - 50), Math.min(frontText.length, match.index + 50));
        // Skip if this is near "Birth" or "DOB" keywords
        if (!/Birth|DOB/i.test(surroundingText)) {
          validityMatch = match;
          break;
        }
      }
    }

    // PRIORITY 4: If not found in front, check BACK text for NT validity
    if (!validityMatch && backText) {
      validityMatch = backText.match(/NT[^\d]*?(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    }

    // PRIORITY 5: Look for Validity in BACK text
    if (!validityMatch && backText) {
      validityMatch = backText.match(/Validity[^\d]*?(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    }

    // PRIORITY 6: As last resort, find dates and take the last one that's not issue date or DOB
    if (!validityMatch) {
      const allDates = ocrText.match(/\d{2}[-\/]\d{2}[-\/]\d{4}/g);
      if (allDates && allDates.length > 0) {
        // Take the last date that's different from issue date and DOB
        for (let i = allDates.length - 1; i >= 0; i--) {
          const date = allDates[i].replace(/\//g, '-');
          if (date !== extractedData.issueDate && date !== extractedData.dob) {
            extractedData.validUpto = date;
            break;
          }
        }
      }
    }

    // Store the matched validity date
    if (validityMatch && validityMatch[1]) {
      extractedData.validUpto = validityMatch[1].replace(/\//g, '-');
    }

    // STEP 5: Extract Name (usually after "Name" label and before S/o, D/o, W/o)
    const nameMatch = ocrText.match(/Name\s*[:\-]?\s*([A-Z\s]+?)(?:\s+(?:S\/o|D\/o|W\/o|Date\s+of\s+Birth|DOB))/i);
    if (nameMatch) {
      extractedData.name = nameMatch[1].trim();
    }

    // STEP 6: Extract Father/Spouse Name (after S/o, D/o, W/o)
    const fatherSpouseMatch = ocrText.match(/(?:S\/o|D\/o|W\/o)\s*[:\-]?\s*([A-Z\s]+?)(?:\s+(?:Date\s+of\s+Birth|DOB|Permanent|Address))/i);
    if (fatherSpouseMatch) {
      extractedData.fatherSpouseName = fatherSpouseMatch[1].trim();
    }

    // Extract Blood Group - try multiple patterns
    // Pattern 1: "Blood Group: AB+" or "Blood Group AB+"
    let bloodGroupMatch = ocrText.match(/Blood\s*Group\s*[:\-]?\s*((?:A|B|AB|O)[+\-])/i);
    if (!bloodGroupMatch) {
      // Pattern 2: Look for blood group pattern anywhere (more lenient)
      bloodGroupMatch = ocrText.match(/\b((?:A|B|AB|O)[+\-])\b/);
    }
    if (bloodGroupMatch) {
      extractedData.bloodGroup = bloodGroupMatch[1].toUpperCase();
    }

    // Extract Permanent Address (between "Permanent Address" and next field)
    const addressMatch = ocrText.match(/Permanent\s*Address[:\-\s]*([^\n]+(?:\n[^\n]+)*?)(?=\s*(?:Present\s*Address|Badge|Class\s+of\s+Vehicle|Emergency|$))/i);
    if (addressMatch) {
      extractedData.address = addressMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Extract Vehicle Classes from BACK text (look for COV, Class of Vehicle, or common codes)
    const vehicleClassMatches = ocrText.match(/(?:MCWG|LMV|HGMV|HPMV|TRANS)/gi);
    if (vehicleClassMatches) {
      extractedData.vehicleClasses = [...new Set(vehicleClassMatches.map(v => v.toUpperCase()))].join(', ');
    }

    // Post-process: Clean all extracted fields
    for (const [key, value] of Object.entries(extractedData)) {
      if (!value) continue;

      let cleaned = value;

      // Remove leading/trailing dots, commas, and spaces
      cleaned = cleaned.replace(/^[.\s,]+|[.\s,]+$/g, '');

      // Special cleaning for address
      if (key === 'address') {
        // Remove stray dots
        cleaned = cleaned.replace(/^\s*\.\s*/g, ''); // Leading dot
        cleaned = cleaned.replace(/\.\s*\.+/g, '.'); // Multiple consecutive dots
        cleaned = cleaned.replace(/\s+\.\s+/g, ' '); // Dot with spaces around it
        cleaned = cleaned.replace(/\.([A-Z])/g, ' $1'); // Dot before capital letter
        cleaned = cleaned.replace(/\s{2,}/g, ' '); // Multiple spaces
      }

      // Clean up license number - remove all spaces
      if (key === 'licenseNumber') {
        cleaned = cleaned.replace(/\s+/g, '');
      }

      // Standardize dates
      if (['dob', 'issueDate', 'validUpto'].includes(key)) {
        cleaned = cleaned.replace(/\//g, '-');
      }

      // Clean up names - remove extra spaces
      if (['name', 'fatherSpouseName'].includes(key)) {
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
      }

      extractedData[key] = cleaned.trim();
    }

    console.log('[DL Regex Extraction] Extracted data:', JSON.stringify(extractedData, null, 2));
    return extractedData;

  } catch (error) {
    console.error('[DL Regex Extraction] Error:', error.message);
    return extractedData; // Return whatever we managed to extract
  }
};

module.exports = {
  extractDLFieldsWithAI,
  extractDLFieldsWithRegex
};
