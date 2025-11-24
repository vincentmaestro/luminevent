import nodemailer from 'nodemailer';
import config from '../config';
import logger from '../utils/logger';
import { EmailJobData } from '../types';
import mail from '@sendgrid/mail';

export const nodemailTransport = nodemailer.createTransport({
	host: 'smtp.gmail.com',
	port: 587,
	secure: false,
	auth: {
		user: config.EMAIL_USER,
		pass: config.EMAIL_PASSWORD,
	},
	tls: {
		ciphers: 'SSLv3',
		rejectUnauthorized: config.NODE_ENV !== 'production' ? false : true, // for local dev; remove in production
	},
});

const companyName = 'Luminevent';
const supportEmail = 'support@luminevent.com';

export async function sendUserVerificationEmail(
	token: string,
	to: string,
    // @ts-ignore
	callback_url = '/',
): Promise<void> {
	// const verificationUrl = `${config.EMAIL_VERIFICATION_URL}?token=${token}&callback_url=${callback_url}`;
	const verificationUrl = `${config.EMAIL_VERIFICATION_URL}?token=${token}`;

	const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background-color: #f4f4f7;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
            background-color: #2c3e50;
            padding: 40px 20px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px 40px;
            color: #34495e;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            margin-top: 20px;
            background-color: #3498db;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
        }
        .footer {
            padding: 20px 40px;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
            border-top: 1px solid #ecf0f1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${companyName}</h1>
        </div>
        <div class="content">
            <h2>Hello,</h2>
            <p>Thanks for signing up for an account with ${companyName}! To get started, you'll need to verify your email address.</p>
            <p>Click the button below to confirm your email and activate your account:</p>
            <a href="${verificationUrl}" class="button">Verify My Email</a>
            <p style="margin-top: 20px;">This verification link will expire in 30 minutes. If the button above doesn't work, you can copy and paste the following URL into your web browser:</p>
            <p style="word-break: break-all; color: #3498db;">${verificationUrl}</p>
            <p style="margin-top: 30px;">If you did not sign up for an account with ${companyName}, please ignore this email.</p>
            <p>Thank you,<br>The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            <p><a href="mailto:${supportEmail}" style="color: #7f8c8d; text-decoration: none;">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
    `;

	const textTemplate = `
Welcome to ${companyName}!

Thanks for signing up. To verify your account, please click the link below:

Verification Link: ${verificationUrl}

This link will expire in 30 minutes.

If you did not sign up for ${companyName}, please ignore this message.

Thanks,
The ${companyName} Team
    `;

	try {
		await mail.send({
			from: config.FROM_EMAIL,
			to,
			subject: 'Verify Your Luminevent Account',
			text: textTemplate,
			html: htmlTemplate,
		});
	} catch (error) {
		logger('[SendVerificationEmailError]').error(error);
		try {
			await nodemailTransport.sendMail({
				from: config.FROM_EMAIL,
				to,
				subject: 'Verify Your Luminevent Account',
				text: textTemplate,
				html: htmlTemplate,
			});
			logger('[NodemailerVerificationEmail]').info(
				`Sent verification email to ${to} using Nodemailer`,
			);
		} catch (nodemailerError) {
			logger('[NodemailerVerificationEmailError]').error(nodemailerError);
			throw new Error('Failed to send verification email');
		}
	}
}

export async function sendTransactionalEmail(data: EmailJobData): Promise<void> {
	try {
		await mail.send({
			from: config.FROM_EMAIL,
			to: data.to,
			subject: data.subject,
			html: data.html,
			text: data.text!, // Ensure text is always provided
		});
	} catch (error) {
		logger('[]').error(error);
		throw new Error('Failed to send transactional email');
	}
}

export async function sendPasswordResetEmail(
	token: string,
	to: string,
	// @ts-ignore
	callback_url = '/',
): Promise<void> {
	// const resetUrl = `${config.EMAIL_RESET_URL}?token=${token}&callback_url=${callback_url}`;
	const resetUrl = `${config.EMAIL_RESET_URL}?token=${token}`;

	const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            background-color: #f4f4f7;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .header {
            background-color: #2c3e50;
            padding: 40px 20px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px 40px;
            color: #34495e;
            line-height: 1.6;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            margin-top: 20px;
            background-color: #3498db;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
        }
        .footer {
            padding: 20px 40px;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
            border-top: 1px solid #ecf0f1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${companyName}</h1>
        </div>
        <div class="content">
            <h2>Hello,</h2>
            <p>We received a request to reset the password for your account.</p>
            <p>To proceed with the password reset, please click the button below. This link is only valid for the next 30 minutes.</p>
            <a href="${resetUrl}" class="button">Reset My Password</a>
            <p style="margin-top: 20px;">If the button above does not work, you can copy and paste the following URL into your web browser:</p>
            <p style="word-break: break-all; color: #3498db;">${resetUrl}</p>
            <p style="margin-top: 30px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>Thank you,<br>The ${companyName} Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            <p><a href="mailto:${supportEmail}" style="color: #7f8c8d; text-decoration: none;">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
  `;

	const textTemplate = `
Hi there,

We received a request to reset your ${companyName} password.

Click the link below to set a new password. This link will expire in 30 minutes.

Reset Link: ${resetUrl}

If you didn't request this, you can safely ignore this email.

Thanks,
The ${companyName} Team
  `;

	try {
		await mail.send({
			from: config.FROM_EMAIL,
			to,
			subject: 'Reset Your Luminevent Password',
			text: textTemplate,
			html: htmlTemplate,
		});
	} catch (error) {
		logger('[EMAIL_SERVICE]').error(error);
		try {
			await nodemailTransport.sendMail({
				from: config.FROM_EMAIL,
				to,
				subject: 'Reset Your Luminevent Password',
				text: textTemplate,
				html: htmlTemplate,
			});
			logger('[NodemailerPasswordResetEmail]').info(
				`Sent password reset email to ${to} using Nodemailer`,
			);
		} catch (nodemailerError) {
			logger('[NodemailerPasswordResetEmailError]').error(nodemailerError);
			throw new Error('Failed to send password reset email');
		}
	}
}
