import XLSX from 'xlsx';

// Sample data with all required columns
const sampleData = [
    {
        'Name': 'Rithika Nair',
        'Emergency Contact': '+91 88888',
        'Address': 'Divya Nair, Kazhakootam, Trivandrum, Kerala',
        'Blood Group': 'A+',
        'Father Name': 'Naveen Nair',
        'Mother Name': 'Divya Nair',
        'ID Card Number': 'ID-2024-001',
        'Bus Point': 'Kazhakootam',
        'Date of Birth': '2015-03-15'
    },
    {
        'Name': 'Faizan Khan',
        'Emergency Contact': '+91 97455',
        'Address': 'Khan Manzil, Thampanoor, Trivandrum, Kerala',
        'Blood Group': 'A+',
        'Father Name': 'Imran Khan',
        'Mother Name': 'Shabana Khan',
        'ID Card Number': 'ID-2024-002',
        'Bus Point': 'Thampanoor',
        'Date of Birth': '2015-07-20'
    },
    {
        'Name': 'Gayathri Suresh',
        'Emergency Contact': '+91 80895',
        'Address': 'Bindu Nivas, Pattom, Trivandrum, Kerala',
        'Blood Group': 'B+',
        'Father Name': 'Suresh Kumar',
        'Mother Name': 'Bindu Suresh',
        'ID Card Number': 'ID-2024-003',
        'Bus Point': 'Pattom',
        'Date of Birth': '2014-09-18'
    },
    {
        'Name': 'Daniel Thomas',
        'Emergency Contact': '+91 94462',
        'Address': 'Ancy Villa, Nalanchira, Trivandrum, Kerala',
        'Blood Group': 'AB+',
        'Father Name': 'Thomas Mathew',
        'Mother Name': 'Ancy Thomas',
        'ID Card Number': 'ID-2024-004',
        'Bus Point': 'Nalanchira',
        'Date of Birth': '2015-01-05'
    },
    {
        'Name': 'Harini Rajeev',
        'Emergency Contact': '+91 95628',
        'Address': 'Mini Raj, Vattiyoorkavu, Trivandrum, Kerala',
        'Blood Group': 'O-',
        'Father Name': 'Rajeev Raj',
        'Mother Name': 'Mini Raj',
        'ID Card Number': 'ID-2024-005',
        'Bus Point': 'Vattiyoorkavu',
        'Date of Birth': '2014-05-30'
    },
    {
        'Name': 'Aravind Pradeep',
        'Emergency Contact': '+91 81294',
        'Address': 'Sindhu Sadanam, Karamana, Trivandrum, Kerala',
        'Blood Group': 'A-',
        'Father Name': 'Pradeep Pillai',
        'Mother Name': 'Sindhu Pradeep',
        'ID Card Number': 'ID-2024-006',
        'Bus Point': 'Karamana',
        'Date of Birth': '2015-10-12'
    },
    {
        'Name': 'Fathima Noora',
        'Emergency Contact': '+91 98956',
        'Address': 'Noor Manzil, Peroorkada, Trivandrum, Kerala',
        'Blood Group': 'B-',
        'Father Name': 'Noorudhe Hasan',
        'Mother Name': 'Shahana Noora',
        'ID Card Number': 'ID-2024-007',
        'Bus Point': 'Peroorkada',
        'Date of Birth': '2014-12-25'
    },
    {
        'Name': 'Christy Paul',
        'Emergency Contact': '+91 80754',
        'Address': 'Lincy House, Medical College, Trivandrum, Kerala',
        'Blood Group': 'O+',
        'Father Name': 'Paul Varghese',
        'Mother Name': 'Lincy Paul',
        'ID Card Number': 'ID-2024-008',
        'Bus Point': 'Medical College',
        'Date of Birth': '2015-04-18'
    },
    {
        'Name': 'Vivek Mohan',
        'Emergency Contact': '+91 85904',
        'Address': 'Sheela Nivas, Sreekariyam, Trivandrum, Kerala',
        'Blood Group': 'AB-',
        'Father Name': 'Mohan Kumar',
        'Mother Name': 'Sheela Mohan',
        'ID Card Number': 'ID-2024-009',
        'Bus Point': 'Sreekariyam',
        'Date of Birth': '2014-08-08'
    },
    {
        'Name': 'Amina Rahim',
        'Emergency Contact': '+91 90376',
        'Address': 'Razia Manzil, Nemom, Trivandrum, Kerala',
        'Blood Group': 'A+',
        'Father Name': 'Rahim Abdul',
        'Mother Name': 'Razia Rahim',
        'ID Card Number': 'ID-2024-010',
        'Bus Point': 'Nemom',
        'Date of Birth': '2015-02-14'
    }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleData);

// Set column widths
ws['!cols'] = [
    { wch: 20 },  // Name
    { wch: 18 },  // Emergency Contact
    { wch: 45 },  // Address
    { wch: 12 },  // Blood Group
    { wch: 20 },  // Father Name
    { wch: 20 },  // Mother Name
    { wch: 15 },  // ID Card Number
    { wch: 18 },  // Bus Point
    { wch: 15 }   // Date of Birth
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Students');

// Write file
XLSX.writeFile(wb, 'sample_student_import.xlsx');

console.log('✅ Sample Excel file created: sample_student_import.xlsx');
