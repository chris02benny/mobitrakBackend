const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const passport = require('passport');
const auth = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinaryConfig');
const { sendVerificationRequestEmail } = require('../services/emailService');

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendOtpEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Mobitrak - Verify Your Email',
            text: `Your Verification Code is: ${otp}\n\nThis code expires in 10 minutes.`
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Email could not be sent');
    }
};

// @route   POST /api/users/register/fleetmanager
// @desc    Register a new fleet manager
// @access  Public
router.post('/register/fleetmanager', async (req, res) => {
    try {
        const { companyName, businessEmail, password } = req.body;

        // Validation
        if (!companyName || !businessEmail || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        // Check for existing user
        const existingUser = await User.findOne({ email: businessEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Create new user (Not Verified yet)
        const newUser = new User({
            email: businessEmail,
            password: hashedPassword,
            companyName,
            role: 'fleetmanager',
            otp,
            otpExpires,
            isVerified: false
        });

        await newUser.save();
        await sendOtpEmail(businessEmail, otp);

        res.status(201).json({
            message: 'Registration successful. OTP sent to your email. Please verify to complete registration.',
            email: businessEmail
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/register/driver
// @desc    Register a new driver
// @access  Public
router.post('/register/driver', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: 'driver',
            otp,
            otpExpires,
            isVerified: false
        });

        await newUser.save();
        await sendOtpEmail(email, otp);

        res.status(201).json({
            message: 'Registration successful. OTP sent to your email. Please verify to complete registration.',
            email: email
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/verify-otp
// @desc    Verify OTP and Activate Account
// @access  Public
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        // Find user by email and select OTP fields
        const user = await User.findOne({ email }).select('+otp +otpExpires');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'User already verified. Please login.' });
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Check if OTP expired
        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP Expired' });
        }

        // Activate User and Clear OTP
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Create token
        const payload = {
            user: {
                id: user._id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 3600 * 24 },
            (err, token) => {
                if (err) throw err;
                res.json({
                    message: 'Email verification successful',
                    token,
                    user: {
                        id: user._id,
                        email: user.email,
                        role: user.role,
                        companyName: user.companyName,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isProfileComplete: user.isProfileComplete,
                        dlFrontImage: user.dlFrontImage,
                        dlBackImage: user.dlBackImage,
                        hasPassword: !!user.password
                    }
                });
            }
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Please enter all fields' });
        }

        // Check for existing user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User does not exist' });
        }

        // Validate password
        // Check if user has a password (google auth users might not)
        if (!user.password) {
            return res.status(400).json({ message: 'Invalid credentials. Try Google Login.' });
        }

        // Check if verified
        if (!user.isVerified) {
            return res.status(403).json({ message: 'Email not verified. Please verify your email.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create token (payload)
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // Sign token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 3600 * 24 }, // 1 day
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        companyName: user.companyName,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isProfileComplete: user.isProfileComplete,
                        dlFrontImage: user.dlFrontImage,
                        dlBackImage: user.dlBackImage,
                        hasPassword: !!user.password
                    }
                });
            }
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        // Check if user has a password (Google auth users might not have password)
        if (!user.password) {
            return res.status(400).json({ message: 'This account uses Google Sign-In. Please use Google to login.' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Save OTP to user
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();

        // Send OTP email
        await sendOtpEmail(email, otp);

        res.json({
            message: 'Password reset OTP sent to your email',
            email: email
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Server Error. Please try again.' });
    }
});

// @route   POST /api/users/verify-reset-otp
// @desc    Verify OTP for password reset
// @access  Public
router.post('/verify-reset-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        // Find user and select OTP fields
        const user = await User.findOne({ email }).select('+otp +otpExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Check if OTP expired
        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        res.json({
            message: 'OTP verified successfully',
            verified: true
        });

    } catch (err) {
        console.error('Verify reset OTP error:', err);
        res.status(500).json({ message: 'Server Error. Please try again.' });
    }
});

// @route   POST /api/users/reset-password
// @desc    Reset password after OTP verification
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required' });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Find user and select OTP fields
        const user = await User.findOne({ email }).select('+otp +otpExpires +password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if OTP matches
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Check if OTP expired
        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server Error. Please try again.' });
    }
});

// @route   GET /api/users/auth/google
// @desc    Auth with Google
// @access  Public
router.get('/auth/google', (req, res, next) => {
    const role = req.query.role || 'fleetmanager'; // Default to fleetmanager if not specified
    const state = role; // Pass role in state
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: state
    })(req, res, next);
});

// @route   GET /api/users/auth/google/callback
// @desc    Google auth callback
// @access  Public
router.get('/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }), // Change failureRedirect as needed
    (req, res) => {
        // Successful authentication
        const user = req.user;

        // Create Token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 3600 * 24 },
            (err, token) => {
                if (err) throw err;

                // Redirect to frontend with token
                // We need to know where the frontend is running. Assuming localhost:3000 for now or configurable.
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

                // Encode user data to pass to frontend if needed or just token
                // Passing a flag if they need to complete profile (missing companyName or driverLicenseId)
                let needsCompletion = false;
                if (user.role === 'fleetmanager' && !user.companyName) needsCompletion = true;
                if (user.role === 'driver' && (!user.driverLicenseId)) needsCompletion = true;

                res.redirect(`${frontendUrl}/auth/google/callback?token=${token}&role=${user.role}&needsCompletion=${needsCompletion}`);
            }
        );
    }
);

// @route   POST /api/users/complete-profile
// @desc    Complete profile after Google Auth (add company name or license id)
// @access  Private
router.post('/complete-profile', auth, async (req, res) => {
    try {
        const { companyName, driverLicenseId, firstName, lastName } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (companyName) user.companyName = companyName;
        if (driverLicenseId) user.driverLicenseId = driverLicenseId;
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
                driverLicenseId: user.driverLicenseId,
                hasPassword: !!user.password
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});



// @route   POST /api/users/update-password
// @desc    Update or Set User Password
// @access  Private
router.post('/update-password', auth, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp -otpExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                officeLocation: user.officeLocation,
                isProfileComplete: user.isProfileComplete,
                dlDetails: user.dlDetails,
                dlFrontImage: user.dlFrontImage,
                dlBackImage: user.dlBackImage,
                hasPassword: !!user.password,
                // Verification fields
                isVerifiedBusiness: user.isVerifiedBusiness,
                verificationStatus: user.verificationStatus,
                verificationRequestedAt: user.verificationRequestedAt,
                verificationProcessedAt: user.verificationProcessedAt,
                verificationNotes: user.verificationNotes
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile details
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { companyName, firstName, lastName, officeLocation } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields if provided
        if (companyName !== undefined) user.companyName = companyName;
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (officeLocation !== undefined) {
            console.log('Received officeLocation:', JSON.stringify(officeLocation, null, 2));
            user.officeLocation = officeLocation;
        }

        await user.save();

        console.log('Saved user officeLocation:', JSON.stringify(user.officeLocation, null, 2));

        // Broadcast office location update via Socket.IO if office location changed
        if (officeLocation !== undefined) {
            const io = req.app.get('io');
            if (io) {
                const locationUpdate = {
                    userId: user._id,
                    officeLocation: user.officeLocation,
                    companyName: user.companyName,
                    timestamp: new Date()
                };
                
                // Broadcast to user's room (all their open sessions)
                io.to(`user-${user._id}`).emit('office-location-update', locationUpdate);
                console.log('Broadcasted office location update to user room:', `user-${user._id}`);
            }

            // Create notification for office location update
            const NotificationService = require('../services/notificationService');
            await NotificationService.notifyOfficeLocationUpdate(user._id, {
                address: officeLocation.address,
                coordinates: officeLocation.coordinates
            });
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                officeLocation: user.officeLocation,
                isProfileComplete: user.isProfileComplete,
                dlFrontImage: user.dlFrontImage,
                dlBackImage: user.dlBackImage,
                hasPassword: !!user.password
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/profile/image
// @desc    Upload profile image
// @access  Private
router.post('/profile/image', auth, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user's profile image with Cloudinary URL
        user.profileImage = req.file.path;
        await user.save();

        res.json({
            message: 'Profile image uploaded successfully',
            profileImage: user.profileImage
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/upload-dl
// @desc    Upload driving license images and extract details
// @access  Private (Driver only)
router.post('/upload-dl', auth, upload.fields([
    { name: 'dlFront', maxCount: 1 },
    { name: 'dlBack', maxCount: 1 }
]), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'driver') {
            return res.status(403).json({ message: 'Only drivers can upload driving licenses' });
        }

        if (!req.files || !req.files.dlFront || !req.files.dlBack) {
            return res.status(400).json({ message: 'Both front and back images of driving license are required' });
        }

        const dlFrontUrl = req.files.dlFront[0].path;
        const dlBackUrl = req.files.dlBack[0].path;

        console.log('[DL Upload] Front:', dlFrontUrl);
        console.log('[DL Upload] Back:', dlBackUrl);

        // Extract text from both images using OCR
        const { extractTextFromImage } = require('../services/ocrSpace.service');
        const { extractDLFieldsWithAI, extractDLFieldsWithRegex } = require('../services/dlExtraction.service');

        // Extract from front (usually contains most details)
        const frontText = await extractTextFromImage(dlFrontUrl);
        console.log('[DL Upload] Front OCR text length:', frontText.length);

        // Extract from back (may contain additional info)
        const backText = await extractTextFromImage(dlBackUrl);
        console.log('[DL Upload] Back OCR text length:', backText.length);

        // Combine both texts for better extraction
        const combinedText = `FRONT:\n${frontText}\n\nBACK:\n${backText}`;

        // Try AI extraction first, fall back to regex if it fails
        let dlDetails = await extractDLFieldsWithAI(combinedText);

        if (!dlDetails) {
            console.log('[DL Upload] AI extraction failed, using regex fallback...');
            dlDetails = extractDLFieldsWithRegex(combinedText);
        }

        // Update user profile (but don't mark as complete yet - needs verification)
        user.dlFrontImage = dlFrontUrl;
        user.dlBackImage = dlBackUrl;
        user.dlDetails = dlDetails;

        await user.save();

        res.json({
            message: 'Driving license uploaded and processed successfully',
            dlDetails: user.dlDetails,
            dlFrontImage: user.dlFrontImage,
            dlBackImage: user.dlBackImage,
            isProfileComplete: user.isProfileComplete
        });

    } catch (err) {
        console.error('[DL Upload] Error:', err);
        res.status(500).json({
            message: 'Server Error processing driving license',
            error: err.message
        });
    }
});

// @route   POST /api/users/verify-dl
// @desc    Verify and save DL details after user confirmation
// @access  Private (Driver only)
router.post('/verify-dl', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'driver') {
            return res.status(403).json({ message: 'Only drivers can verify driving licenses' });
        }

        const { dlDetails } = req.body;

        if (!dlDetails) {
            return res.status(400).json({ message: 'DL details are required' });
        }

        // Update user with verified details
        user.dlDetails = dlDetails;
        user.isProfileComplete = true;

        await user.save();

        res.json({
            message: 'Driving license details verified successfully',
            dlDetails: user.dlDetails,
            isProfileComplete: user.isProfileComplete,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                dlFrontImage: user.dlFrontImage,
                dlBackImage: user.dlBackImage,
                dlDetails: user.dlDetails,
                isProfileComplete: user.isProfileComplete
            }
        });

    } catch (err) {
        console.error('[DL Verify] Error:', err);
        res.status(500).json({
            message: 'Server Error verifying driving license',
            error: err.message
        });
    }
});

// @route   POST /api/users/upload-rc
// @desc    Upload RC book image and extract details
// @access  Private (Driver only)
router.post('/upload-rc', auth, upload.single('rcBook'), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'driver') {
            return res.status(403).json({ message: 'Only drivers can upload RC books' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'RC book image is required' });
        }

        const rcBookUrl = req.file.path;
        console.log('[RC Upload] Processing:', rcBookUrl);

        // Extract details
        const { extractRC } = require('../services/rcExtraction.service');
        const extractionResult = await extractRC(rcBookUrl);

        // Update user
        user.rcBookImage = rcBookUrl;
        user.rcDetails = extractionResult.extractedData;

        // Re-evaluate profile completion
        if (user.dlDetails && user.dlDetails.licenseNumber) {
            user.isProfileComplete = true;
        }

        await user.save();

        res.json({
            message: 'RC book uploaded and processed successfully',
            rcDetails: user.rcDetails,
            rcBookImage: user.rcBookImage,
            isProfileComplete: user.isProfileComplete
        });

    } catch (err) {
        console.error('[RC Upload] Error:', err);
        res.status(500).json({
            message: 'Server Error processing RC book',
            error: err.message
        });
    }
});

// @route   POST /api/users/logout
// @desc    Logout user (optional endpoint for logging/future token blacklist)
// @access  Private
router.post('/logout', auth, async (req, res) => {
    try {
        // Currently just logging the logout event
        // In future, can implement token blacklist here
        console.log(`User ${req.user.id} logged out at ${new Date().toISOString()}`);

        res.json({ message: 'Logout successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   POST /api/users/request-verification
// @desc    Request business verification (Fleet Manager only)
// @access  Private
router.post('/request-verification', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'fleetmanager') {
            return res.status(403).json({ message: 'Only fleet managers can request business verification' });
        }
        
        if (user.isVerifiedBusiness) {
            return res.status(400).json({ message: 'Business is already verified' });
        }
        
        if (user.verificationStatus === 'pending') {
            return res.status(400).json({ message: 'Verification request is already pending' });
        }
        
        // Check if required fields are filled
        if (!user.companyName) {
            return res.status(400).json({ message: 'Please complete your company name before requesting verification' });
        }
        
        user.verificationStatus = 'pending';
        user.verificationRequestedAt = new Date();
        
        await user.save();
        
        // Send email notification
        await sendVerificationRequestEmail(user.email, user.companyName);
        
        res.json({
            message: 'Verification request submitted successfully. Our team will review your profile.',
            verificationStatus: user.verificationStatus,
            verificationRequestedAt: user.verificationRequestedAt
        });
    } catch (err) {
        console.error('Error requesting verification:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/users/verification-status
// @desc    Get current verification status (Fleet Manager only)
// @access  Private
router.get('/verification-status', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            isVerifiedBusiness: user.isVerifiedBusiness,
            verificationStatus: user.verificationStatus,
            verificationRequestedAt: user.verificationRequestedAt,
            verificationProcessedAt: user.verificationProcessedAt,
            verificationNotes: user.verificationNotes
        });
    } catch (err) {
        console.error('Error getting verification status:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/users/drivers/available
// @desc    Get available drivers with complete profiles (for hiring)
// @access  Public (internal service use)
router.get('/drivers/available', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = {
            role: 'driver',
            isProfileComplete: true,
            $or: [
                { companyName: 'Unemployed' },
                { companyName: { $exists: false } },
                { companyName: null }
            ]
        };

        const [drivers, total] = await Promise.all([
            User.find(query)
                .select('-password -otp -otpExpires')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            User.countDocuments(query)
        ]);

        res.json({
            success: true,
            drivers: drivers.map(user => ({
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                companyName: user.companyName || 'Unemployed',
                dlDetails: user.dlDetails,
                isProfileComplete: user.isProfileComplete,
                createdAt: user.createdAt
            })),
            total,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total
            }
        });
    } catch (err) {
        console.error('Error fetching available drivers:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/users/:userId
// @desc    Get user by ID (for inter-service communication)
// @access  Public (internal service use)
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password -otp -otpExpires');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage,
                officeLocation: user.officeLocation,
                isProfileComplete: user.isProfileComplete,
                isVerifiedBusiness: user.isVerifiedBusiness,
                verificationStatus: user.verificationStatus,
                dlDetails: user.dlDetails,
                phone: user.phone,
                assignmentStatus: user.assignmentStatus
            }
        });
    } catch (err) {
        console.error('Error fetching user by ID:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
