import ExcelJS from 'exceljs';

interface AttendanceReportData {
    session: {
        title: string;
        courseName: string;
        courseCode: string;
        date: Date;
        professorName: string;
    };
    records: Array<{
        studentName: string;
        universityId: string;
        email: string;
        status: string;
        markedAt: Date | null;
        fraudScore: number;
        deviceInfo?: string;
    }>;
}

export class ReportService {
    /**
     * Generate Attendance Excel Report
     */
    static async generateAttendanceReport(data: AttendanceReportData): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Smart Campus Assistant';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Attendance Report');

        // Add Title and Info
        sheet.mergeCells('A1:F1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = `Attendance Report - ${data.session.courseName} (${data.session.courseCode})`;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:F2');
        const subTitleCell = sheet.getCell('A2');
        subTitleCell.value = `Session: ${data.session.title} | Date: ${data.session.date.toLocaleDateString()} | Professor: ${data.session.professorName}`;
        subTitleCell.font = { size: 12, italic: true };
        subTitleCell.alignment = { horizontal: 'center' };

        // Empty row
        sheet.addRow([]);

        // Headers
        const headers = ['University ID', 'Student Name', 'Email', 'Status', 'Time', 'Fraud Score'];
        const headerRow = sheet.addRow(headers);

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F81BD' } // Blue header
            };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Data
        data.records.forEach((record) => {
            const row = sheet.addRow([
                record.universityId,
                record.studentName,
                record.email,
                record.status,
                record.markedAt ? record.markedAt.toLocaleTimeString() : '-',
                record.fraudScore
            ]);

            // Style the status cell
            const statusCell = row.getCell(4);
            if (record.status === 'PRESENT') {
                statusCell.font = { color: { argb: 'FF006100' } }; // Green
            } else if (record.status === 'ABSENT') {
                statusCell.font = { color: { argb: 'FF9C0006' } }; // Red
            } else if (record.status === 'LATE') {
                statusCell.font = { color: { argb: 'FF9C5700' } }; // Orange
            }

            // Conditional formatting for high fraud score
            const fraudCell = row.getCell(6);
            if (record.fraudScore > 50) {
                fraudCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' } // Light red background
                };
                fraudCell.font = { color: { argb: 'FF9C0006' } };
            }
        });

        // Auto-fit columns
        sheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Generate buffer
        // writeBuffer returns Promise<Buffer> in newer exceljs, or we can use write to stream. 
        // Typescript definition says writeBuffer(): Promise<Buffer>
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as unknown as Buffer;
    }
}
