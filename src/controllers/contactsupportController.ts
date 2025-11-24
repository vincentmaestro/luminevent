import { Body, Controller, Post, Route, Tags, SuccessResponse } from 'tsoa';
import { db } from '../db';
import { contactSupport } from '../db/schemas/contactSupport';
import nodemailer from 'nodemailer';
import { ContactSupportDTO } from '../types';

@Route('contact-support')
@Tags('Contact Support')
export class ContactSupportController extends Controller {
	/**
	 * Submit a contact support inquiry
	 */
	@Post('/')
	@SuccessResponse('201', 'Created')
	public async submitContactSupport(
		@Body() body: ContactSupportDTO,
	): Promise<{ message: string }> {
		const {
			firstName,
			lastName,
			companyName,
			organizationType,
			phoneNumber,
			reasonForContact,
			email,
		} = body;
		console.log(body);
		// 1. Store submission in database
		await db.insert(contactSupport).values({
			firstName,
			lastName,
			email,
			companyName,
			organizationType,
			phoneNumber,
			reasonForContact,
		});

		// 2. Send confirmation email
		const transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASSWORD,
			},
		});

		await transporter.sendMail({
			from: process.env.FROM_EMAIL,
			to: email,
			subject: 'We received your inquiry',
			text: `Hello ${firstName} ${lastName},
Thank you for reaching out. Our team will get back to you soon.

Your reason for contact: ${reasonForContact}
Company: ${companyName ?? 'N/A'}
Organization Type: ${organizationType ?? 'N/A'}
Phone: ${phoneNumber ?? 'N/A'}

- Support Team`,
		});
		console.log('Sent email');

		this.setStatus(201);
		return { message: 'Contact support request submitted successfully' };
	}
}
