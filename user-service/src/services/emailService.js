const nodemailer = require('nodemailer');

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send verification request received email
 */
const sendVerificationRequestEmail = async (email, companyName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Mobitrak - Verification Request Received',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; }
                        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
                        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                        .icon { font-size: 48px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">📋</div>
                            <h1>Verification Request Received</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${companyName}</strong>,</p>
                            
                            <p>Thank you for submitting your verification request on Mobitrak!</p>
                            
                            <div class="highlight">
                                <strong>🔍 What happens next?</strong>
                                <p style="margin: 10px 0 0 0;">Our verification team will review your business profile, registered vehicles, and uploaded documents. This process typically takes 1-3 business days.</p>
                            </div>
                            
                            <p><strong>During the review, we'll check:</strong></p>
                            <ul>
                                <li>Your business information and profile</li>
                                <li>Registered vehicles and their documents</li>
                                <li>RC Book uploads and vehicle images</li>
                            </ul>
                            
                            <p>You'll receive an email notification once your verification has been processed.</p>
                            
                            <p>If you have any questions, feel free to contact our support team.</p>
                            
                            <p>Best regards,<br><strong>The Mobitrak Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Mobitrak. All rights reserved.</p>
                            <p>This is an automated message, please do not reply directly to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('Verification request email sent to:', email);
    } catch (error) {
        console.error('Error sending verification request email:', error);
        // Don't throw - email failure shouldn't block the main operation
    }
};

/**
 * Send verification approved email
 */
const sendVerificationApprovedEmail = async (email, companyName) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: '🎉 Mobitrak - Your Business is Now Verified!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; }
                        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .badge { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
                        .badge-icon { font-size: 48px; }
                        .benefits { background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                        .benefits ul { margin: 10px 0; padding-left: 20px; }
                        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                        .icon { font-size: 48px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🎉</div>
                            <h1>Congratulations! You're Verified!</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${companyName}</strong>,</p>
                            
                            <p>Great news! Your business has been verified by the Mobitrak team.</p>
                            
                            <div class="badge">
                                <div class="badge-icon">✓</div>
                                <h2 style="margin: 10px 0;">Mobitrak Verified Business</h2>
                                <p style="margin: 0; opacity: 0.9;">Your profile now displays the verification badge</p>
                            </div>
                            
                            <div class="benefits">
                                <strong>🌟 Your verified benefits:</strong>
                                <ul>
                                    <li>Verification badge displayed on your profile</li>
                                    <li>Increased trust and credibility with drivers</li>
                                    <li>Priority visibility in search results</li>
                                    <li>Access to premium features</li>
                                </ul>
                            </div>
                            
                            <p>Thank you for being a trusted partner on Mobitrak!</p>
                            
                            <p>Best regards,<br><strong>The Mobitrak Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Mobitrak. All rights reserved.</p>
                            <p>This is an automated message, please do not reply directly to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('Verification approved email sent to:', email);
    } catch (error) {
        console.error('Error sending verification approved email:', error);
    }
};

/**
 * Send verification rejected email
 */
const sendVerificationRejectedEmail = async (email, companyName, notes = '') => {
    try {
        const notesSection = notes ? `
            <div class="notes">
                <strong>📝 Reviewer Notes:</strong>
                <p style="margin: 10px 0 0 0;">${notes}</p>
            </div>
        ` : '';

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Mobitrak - Verification Request Update',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #6b7280, #4b5563); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; }
                        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .status { background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0; }
                        .notes { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
                        .next-steps { background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
                        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                        .icon { font-size: 48px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">📋</div>
                            <h1>Verification Request Update</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${companyName}</strong>,</p>
                            
                            <p>We have reviewed your verification request on Mobitrak.</p>
                            
                            <div class="status">
                                <strong>Status: Not Approved</strong>
                                <p style="margin: 10px 0 0 0;">Unfortunately, we were unable to verify your business at this time.</p>
                            </div>
                            
                            ${notesSection}
                            
                            <div class="next-steps">
                                <strong>📌 What you can do:</strong>
                                <ul style="margin: 10px 0; padding-left: 20px;">
                                    <li>Review and update your business profile information</li>
                                    <li>Ensure all vehicle documents are clear and valid</li>
                                    <li>Upload high-quality RC Book images</li>
                                    <li>Submit a new verification request when ready</li>
                                </ul>
                            </div>
                            
                            <p>If you believe this was an error or have questions, please contact our support team for assistance.</p>
                            
                            <p>Best regards,<br><strong>The Mobitrak Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Mobitrak. All rights reserved.</p>
                            <p>This is an automated message, please do not reply directly to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        await transporter.sendMail(mailOptions);
        console.log('Verification rejected email sent to:', email);
    } catch (error) {
        console.error('Error sending verification rejected email:', error);
    }
};

module.exports = {
    sendVerificationRequestEmail,
    sendVerificationApprovedEmail,
    sendVerificationRejectedEmail
};
