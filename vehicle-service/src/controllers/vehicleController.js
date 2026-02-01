const Vehicle = require('../models/Vehicle');
const { extractTextFromImage } = require('../services/ocrSpace.service');
const { extractRCFieldsWithAI } = require('../services/aiExtraction.service');

/**
 * Parse raw OCR text into structured vehicle data
 * @param {string} text - Raw OCR text from RC book
 * @returns {object} Structured vehicle data
 */
const parseRCText = (text) => {
    const data = {};

    // Helper function to extract field value using multiple patterns
    const extractField = (patterns) => {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    };

    // Registration Number
    data.regnNo = extractField([
        /Regn\.?\s*No\.?\s*[:\-]?\s*([A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{1,4})/i,
        /Registration\s*Number\s*[:\-]?\s*([A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{1,4})/i,
        /([A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{1,4})/
    ]);

    // Date of Registration
    data.dateOfRegn = extractField([
        /Date\s*of\s*Registration\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /Date\s*of\s*Regn\.?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /Registration\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /Regn\.?\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /Date\s+of\s+Registration\s*:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ]);

    // Registration Validity
    data.regnValidity = extractField([
        /Regn\.?\s*Validity\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
        /Valid\s*Upto\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
        /Validity\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i
    ]);

    // Chassis Number
    data.chassisNo = extractField([
        /Chassis\s*No\.?\s*[:\-]?\s*([A-Z0-9]{10,20})/i,
        /Chassis\s*Number\s*[:\-]?\s*([A-Z0-9]{10,20})/i,
        /Ch\.?\s*No\.?\s*[:\-]?\s*([A-Z0-9]{10,20})/i
    ]);

    // Engine Number
    data.engineNo = extractField([
        /Engine\s*No\.?\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
        /Engine\s*Number\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
        /Eng\.?\s*No\.?\s*[:\-]?\s*([A-Z0-9]{5,20})/i
    ]);

    // Owner Name
    data.ownerName = extractField([
        /Owner\s*Name\s*[:\-]?\s*([A-Z\s\.]{3,50})/i,
        /Name\s*of\s*Owner\s*[:\-]?\s*([A-Z\s\.]{3,50})/i,
        /Owner\s*[:\-]?\s*([A-Z\s\.]{3,50})/i
    ]);

    // Address
    data.address = extractField([
        /Address\s*[:\-]?\s*([A-Z0-9\s,\.\-\/]{10,200})/i,
        /Owner.*?Address\s*[:\-]?\s*([A-Z0-9\s,\.\-\/]{10,200})/i
    ]);

    // Tax Upto
    data.taxUpto = extractField([
        /Tax\s*Upto\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
        /Tax\s*Valid\s*Upto\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
        /Tax\s*Validity\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i
    ]);

    // Fuel Used
    data.fuelUsed = extractField([
        /Fuel\s*Used\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)/i,
        /Fuel\s*Type\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)/i,
        /Fuel\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)/i
    ]);

    // Date of Effect
    data.dateOfEffect = extractField([
        /Date\s*of\s*Effect\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
        /Effect\s*Date\s*[:\-]?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i
    ]);

    // Vehicle Class
    data.vehicleClass = extractField([
        /Vehicle\s*Class\s*[:\-]?\s*([A-Z0-9\s\-]{2,30})/i,
        /Class\s*of\s*Vehicle\s*[:\-]?\s*([A-Z0-9\s\-]{2,30})/i,
        /V\.?\s*Class\s*[:\-]?\s*([A-Z0-9\s\-]{2,30})/i
    ]);

    // Maker's Name
    data.makersName = extractField([
        /Maker'?s?\s*Name\s*[:\-]?\s*([A-Z\s]{2,30})/i,
        /Manufacturer\s*[:\-]?\s*([A-Z\s]{2,30})/i,
        /Make\s*[:\-]?\s*([A-Z\s]{2,30})/i
    ]);

    // Colour
    data.colour = extractField([
        /Colou?r\s*[:\-]?\s*([A-Z\s]{2,20})/i,
        /Vehicle\s*Colou?r\s*[:\-]?\s*([A-Z\s]{2,20})/i
    ]);

    // Body Type
    data.bodyType = extractField([
        /Type\s+of\s+Body\s*:\s*([A-Z\s]{2,30})/i,
        /Type\s*of\s*Body\s*[:\-]?\s*([A-Z\s]{2,30})/i,
        /Body\s*Type\s*[:\-]?\s*([A-Z\s]{2,30})/i
    ]);


    // Seating Capacity
    data.seatingCapacity = extractField([
        /Seating\s+Capacity\s*:\s*(\d{1,3})/i,
        /Seating\s*Capacity\s*[:\-]?\s*(\d{1,3})/i,
        /Seat\s*Cap\.?\s*[:\-]?\s*(\d{1,3})/i,
        /No\.?\s*of\s*Seats\s*[:\-]?\s*(\d{1,3})/i
    ]);

    // Month/Year of Manufacturing
    data.monthYearOfMfg = extractField([
        /Month\s*[&\/]\s*Year\s*of\s*Mfg\.?\s*[:\-]?\s*(\d{1,2}[\-\/]\d{2,4})/i,
        /Mfg\.?\s*Date\s*[:\-]?\s*(\d{1,2}[\-\/]\d{2,4})/i,
        /Manufacturing\s*Date\s*[:\-]?\s*(\d{1,2}[\-\/]\d{2,4})/i
    ]);

    return data;
};

exports.extractRC = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an RC book image' });
        }

        const imagePath = req.file.path; // Cloudinary URL
        console.log(`Processing RC Book for extraction. URL: ${imagePath}`);

        // Use OCR Service to extract text
        const extractedText = await extractTextFromImage(imagePath);
        console.log(`Extracted text length: ${extractedText.length} characters`);
        console.log('First 500 chars of OCR text:', extractedText.substring(0, 500));

        // Try AI-based extraction first
        let extractedData = await extractRCFieldsWithAI(extractedText);

        if (!extractedData) {
            // Fall back to regex-based parsing if AI extraction fails
            console.log('[Extraction] AI extraction unavailable, using regex fallback');
            extractedData = parseRCText(extractedText);
        } else {
            console.log('[Extraction] Successfully used AI extraction');
        }

        console.log('Parsed extracted data:', JSON.stringify(extractedData, null, 2));
        console.log('Returning extracted text and structured data to client.');

        const response = {
            message: 'RC Book processed successfully',
            extractedText: extractedText,
            extractedData: extractedData,
            rcBookImage: imagePath
        };

        console.log('Response keys:', Object.keys(response));
        console.log('extractedData has keys:', Object.keys(extractedData));

        res.json(response);

    } catch (error) {
        console.error('Error in extractRC:', error);
        res.status(500).json({
            message: 'Server error parsing RC book',
            error: error.message || 'Unknown error occurred during OCR'
        });
    }
};

exports.createVehicle = async (req, res) => {
    try {
        console.log('Creating vehicle with body:', req.body);

        // Handle RC Book: 
        // 1. If re-uploaded in this step, use req.files.rcBook[0].path
        // 2. If using previously uploaded URL, use req.body.rcBookImage
        let rcBookPath;
        if (req.files && req.files.rcBook) {
            rcBookPath = req.files.rcBook[0].path;
        } else if (req.body.rcBookImage) {
            rcBookPath = req.body.rcBookImage;
        } else {
            return res.status(400).json({ message: 'RC Book image is required (file or URL)' });
        }

        // Collect vehicle images
        let vehicleImagePaths = [];
        if (req.files && req.files.vehicleImages) {
            vehicleImagePaths = req.files.vehicleImages.map(file => file.path);
        }

        const newVehicle = new Vehicle({
            businessId: req.user.id,
            ...req.body, // Contains extracted & edited fields
            rcBookImage: rcBookPath,
            images: vehicleImagePaths,
            description: req.body.description || ''
        });

        const savedVehicle = await newVehicle.save();

        res.status(201).json({
            message: 'Vehicle added successfully',
            vehicle: savedVehicle
        });

    } catch (error) {
        console.error('Error in createVehicle:', error);
        res.status(500).json({ message: 'Server error saving vehicle', error: error.message || error });
    }
};

exports.getVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ businessId: req.user.id }).sort({ createdAt: -1 });
        res.json(vehicles);
    } catch (error) {
        console.error('Error in getVehicles:', error);
        res.status(500).json({ message: 'Server error fetching vehicles', error: error.message });
    }
};
