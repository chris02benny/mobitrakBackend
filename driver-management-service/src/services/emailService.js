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
 * Send hire request email to driver
 */
const sendHireRequestEmail = async (driverEmail, driverName, companyName, jobDetails) => {
    try {
        const payFrequencyMap = {
            'PER_KM': 'per km',
            'PER_DAY': 'per day',
            'PER_MONTH': 'per month'
        };
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: driverEmail,
            subject: `🚗 New Job Opportunity from ${companyName} - Mobitrak`,
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
                        .job-details { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
                        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
                        .detail-label { color: #6b7280; font-weight: 500; }
                        .detail-value { color: #111827; font-weight: 600; }
                        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
                        .cta-button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
                        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                        .icon { font-size: 48px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">🚗</div>
                            <h1>New Job Opportunity!</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${driverName}</strong>,</p>
                            
                            <p>Great news! <strong>${companyName}</strong> is interested in hiring you!</p>
                            
                            <div class="job-details">
                                <h3 style="margin-top: 0; color: #f59e0b;">Job Details</h3>
                                <div class="detail-row">
                                    <span class="detail-label">Service Type</span>
                                    <span class="detail-value">${jobDetails.serviceType}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Vehicle Type</span>
                                    <span class="detail-value">${jobDetails.vehicleType}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Contract Period</span>
                                    <span class="detail-value">${jobDetails.contractDuration} ${jobDetails.contractUnit}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Accommodation</span>
                                    <span class="detail-value">${jobDetails.accommodation ? 'Provided ✓' : 'Not Provided'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Health Insurance</span>
                                    <span class="detail-value">${jobDetails.healthInsurance ? 'Provided ✓' : 'Not Provided'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Pay</span>
                                    <span class="detail-value">₹${jobDetails.payAmount.toLocaleString()} ${payFrequencyMap[jobDetails.payFrequency] || ''}</span>
                                </div>
                            </div>
                            
                            ${jobDetails.description ? `
                            <div class="highlight">
                                <strong>📝 Additional Details:</strong>
                                <p style="margin: 10px 0 0 0;">${jobDetails.description}</p>
                            </div>
                            ` : ''}
                            
                            <p>Log in to your Mobitrak dashboard to view the full details and respond to this offer.</p>
                            
                            <center>
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/driver/jobs" class="cta-button">View Job Offer</a>
                            </center>
                            
                            <p style="margin-top: 30px;">Best regards,<br><strong>The Mobitrak Team</strong></p>
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
        console.log('Hire request email sent to:', driverEmail);
    } catch (error) {
        console.error('Error sending hire request email:', error);
    }
};

/**
 * Send hire request response email to fleet manager
 */
const sendHireResponseEmail = async (managerEmail, companyName, driverName, response, reason = '') => {
    try {
        const isAccepted = response === 'ACCEPTED';
        const statusColor = isAccepted ? '#10b981' : '#ef4444';
        const statusIcon = isAccepted ? '✓' : '✕';
        const statusText = isAccepted ? 'Accepted' : 'Rejected';
        
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: managerEmail,
            subject: `${isAccepted ? '🎉' : '📋'} Hire Request ${statusText} - ${driverName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, ${statusColor}, ${isAccepted ? '#059669' : '#dc2626'}); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; }
                        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                        .status-badge { display: inline-block; background: ${statusColor}; color: white; padding: 10px 20px; border-radius: 20px; font-weight: 600; margin: 20px 0; }
                        .highlight { background: ${isAccepted ? '#ecfdf5' : '#fef2f2'}; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0; }
                        .cta-button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
                        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                        .icon { font-size: 48px; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="icon">${isAccepted ? '🎉' : '📋'}</div>
                            <h1>Hire Request ${statusText}</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${companyName}</strong>,</p>
                            
                            <p>We have an update regarding your hire request.</p>
                            
                            <center>
                                <div class="status-badge">${statusIcon} ${driverName} has ${statusText.toLowerCase()} your offer</div>
                            </center>
                            
                            ${isAccepted ? `
                            <div class="highlight">
                                <strong>🎉 What's next?</strong>
                                <p style="margin: 10px 0 0 0;">The driver is now part of your team! You can view and manage them from your Drivers page.</p>
                            </div>
                            ` : `
                            <div class="highlight">
                                <strong>📝 Response:</strong>
                                <p style="margin: 10px 0 0 0;">${reason || 'The driver has declined the offer without providing additional details.'}</p>
                            </div>
                            `}
                            
                            <center>
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/business/drivers" class="cta-button">Go to Dashboard</a>
                            </center>
                            
                            <p style="margin-top: 30px;">Best regards,<br><strong>The Mobitrak Team</strong></p>
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
        console.log('Hire response email sent to:', managerEmail);
    } catch (error) {
        console.error('Error sending hire response email:', error);
    }
};

module.exports = {
    sendHireRequestEmail,
    sendHireResponseEmail
};
