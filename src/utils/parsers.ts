import PdfPrinter from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ReceiptData, ReceiptItem } from '../types/';
import logger from "../utils/logger";

// Define fonts for pdfmake (you can customize these or use default ones)
// You might need to provide actual font files in a 'fonts' directory
// and map them here. For simplicity, we'll use a basic setup.
const fonts = {
    Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js', // This path is generally incorrect for actual font files
        // For actual fonts, you'd point to .ttf files:
        // normal: 'path/to/fonts/Roboto-Regular.ttf',
        // bold: 'path/to/fonts/Roboto-Medium.ttf',
        // italics: 'path/to/fonts/Roboto-Italic.ttf',
        // bolditalics: 'path/to/fonts/Roboto-MediumItalic.ttf'
    },
    // You can add other fonts here
};

const printer = new PdfPrinter(fonts);

export class Parsers {
    /** Parses a CSV string into an array of objects. */
    public static parseCSV(csvText: string, delimiter: string = ','): Record<string, unknown>[] {
        const lines = csvText.split('\n').map((row) => row.split(delimiter));
        if (lines.length === 0 || !lines[0]) return [];
        const headers = lines[0];
        const rows = lines.slice(1);
        return rows.map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i]])));
    }

    /** Converts JSON data to CSV format. */
    public static jsonToCSV(jsonArray: Record<string, unknown>[], delimiter: string = ','): string {
        if (jsonArray.length === 0) return '';
        const headers = Object.keys(jsonArray[0]!).join(delimiter);
        const rows = jsonArray.map((obj) => Object.values(obj).join(delimiter)).join('\n');
        return `${headers}\n${rows}`;
    }

    /**
   * Converts JSON receipt data into a PDF buffer.
   *
   * @param {ReceiptData} receiptData - The JSON data representing the receipt.
   * @returns {Promise<Buffer>} A promise that resolves to the PDF document as a Buffer.
   * @throws {Error} If there is an error generating the PDF.
   *
   * @example
   * ```typescript
   * import { Parsers } from './utils/parsers';
   * import { ReceiptData } from './types';
   * import * as fs from 'fs'; // For saving the PDF to a file (example only)
   *
   * async function generateAndSaveReceipt() {
   * const exampleReceipt: ReceiptData = {
   * receiptId: 'INV-2023-001',
   * date: '2023-08-02',
   * customerName: 'Alice Smith',
   * items: [
   * { description: 'Product A', quantity: 2, unitPrice: 10.50, total: 21.00 },
   * { description: 'Service B', quantity: 1, unitPrice: 50.00, total: 50.00 },
   * { description: 'Product C (Discounted)', quantity: 3, unitPrice: 5.00, total: 15.00 },
   * ],
   * subtotal: 86.00,
   * taxRate: 0.08, // 8% tax
   * taxAmount: 6.88,
   * totalAmount: 92.88,
   * currency: 'USD',
   * notes: 'Thank you for your business!'
   * };
   *
   * try {
   * const pdfBuffer = await Parsers.jsonToPDF(exampleReceipt);
   * // In a real application, you might send this buffer as a response,
   * // attach it to an email, or store it in cloud storage.
   * console.log('PDF generated successfully. Buffer size:', pdfBuffer.length, 'bytes');
   *
   * // Example: Save to a file (for demonstration)
   * fs.writeFileSync('receipt.pdf', pdfBuffer);
   * console.log('Receipt saved to receipt.pdf');
   * } catch (error) {
   * console.error('Error generating PDF:', error);
   * }
   * }
   *
   * // To run the example:
   * // generateAndSaveReceipt();
   * ```
   */
    public static jsonToPDF(receiptData: ReceiptData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const docDefinition: TDocumentDefinitions = {
                content: [
                    { text: 'Luminevent', style: 'header' },
                    { text: 'Receipt', style: 'subheader' },
                    { text: `Receipt ID: ${receiptData.receiptId}`, style: 'info' },
                    { text: `Date: ${receiptData.date}`, style: 'info' },
                    { text: `Customer: ${receiptData.customerName}`, style: 'info', margin: [0, 0, 0, 10] },

                    {
                        style: 'tableExample',
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto', 'auto', 'auto'],
                            body: [
                                ['Description', 'Qty', 'Unit Price', 'Total'],
                                ...receiptData.items.map((item: ReceiptItem) => [
                                    item.description,
                                    item.quantity,
                                    `${receiptData.currency} ${item.unitPrice.toFixed(2)}`,
                                    `${receiptData.currency} ${item.total.toFixed(2)}`,
                                ]),
                                [{ text: 'Subtotal', colSpan: 3, alignment: 'right' }, {}, {}, `${receiptData.currency} ${receiptData.subtotal.toFixed(2)}`],
                                [{ text: `Tax (${(receiptData.taxRate * 100).toFixed(0)}%)`, colSpan: 3, alignment: 'right' }, {}, {}, `${receiptData.currency} ${receiptData.taxAmount.toFixed(2)}`],
                                [{ text: 'Total Amount', colSpan: 3, alignment: 'right', bold: true }, {}, {}, { text: `${receiptData.currency} ${receiptData.totalAmount.toFixed(2)}`, bold: true }],
                            ],
                        },
                        layout: 'lightHorizontalLines', // Optional: adds light lines between rows
                    },
                    { text: receiptData.notes || '', style: 'notes', margin: [0, 20, 0, 0] },
                    { text: 'Thank you for your purchase!', style: 'footer', margin: [0, 30, 0, 0] },
                ],
                styles: {
                    header: {
                        fontSize: 22,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 0, 0, 10],
                        color: '#4A90E2', // Blue color for header
                    },
                    subheader: {
                        fontSize: 18,
                        bold: true,
                        alignment: 'center',
                        margin: [0, 0, 0, 20],
                    },
                    info: {
                        fontSize: 12,
                        margin: [0, 2, 0, 2],
                    },
                    tableExample: {
                        margin: [0, 5, 0, 15],
                        fontSize: 10,
                    },
                    notes: {
                        fontSize: 10,
                        italics: true,
                        color: '#555',
                    },
                    footer: {
                        fontSize: 10,
                        alignment: 'center',
                        color: '#888',
                    },
                },
                pageMargins: [40, 40, 40, 40], // Left, Top, Right, Bottom
            };

            try {
                const pdfDoc = printer.createPdfKitDocument(docDefinition);
                const chunks: Buffer[] = [];

                pdfDoc.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                pdfDoc.on('end', () => {
                    const result = Buffer.concat(chunks);
                    resolve(result);
                });

                pdfDoc.on('error', (error) => {
                    logger("[PDF_PARSER]").error('Error during PDF generation:', error);
                    reject(error);
                });

                pdfDoc.end();
            } catch (error) {
                logger("[PDF_PARSER]").error('Failed to create PDF document definition:', error);
                reject(error);
            }
        });
    }
}