
import React from 'react';
import { X, Info, CheckCircle2, AlertCircle, FileSpreadsheet, List, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportInstructionsModal({ isOpen, onClose, dynamicVars = [] }) {
    if (!isOpen) return null;

    const standardFields = [
        { name: 'Name', required: true, key: 'name', examples: 'John Doe' },
        { name: 'Emergency Contact', required: true, key: 'emergencyContact', examples: '9876543210' },
        { name: 'Address', required: true, key: 'address', examples: '123 Main St' },
        { name: 'Blood Group', required: true, key: 'bloodGroup', examples: 'O+' },
        { name: 'Father Name', required: true, key: 'fatherName', examples: 'Robert Doe' },
        { name: 'Mother Name', required: true, key: 'motherName', examples: 'Mary Doe' },
    ];

    const downloadSample = () => {
        const sampleRow = {
            'Full Name': 'John Doe',
            'Emergency No.': '9876543210',
            'Home Address': '123 Main St, City',
            'Blood Group': 'O+',
            'Father Name': 'Robert Doe',
            'Mother Name': 'Mary Doe'
        };

        // Add dynamic fields
        dynamicVars.forEach(v => {
            sampleRow[v.name] = 'Sample ' + v.name;
        });

        const ws = XLSX.utils.json_to_sheet([sampleRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, "student_import_sample.xlsx");
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 uppercase tracking-tighter text-xl">Import Instructions</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Guide for Excel/CSV formatting</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-400 hover:text-red-500 transition-all hover:rotate-90"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-8 space-y-8 flex-1 custom-scrollbar">
                    {/* Format Support */}
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <Info className="w-5 h-5 text-blue-600 shrink-0" />
                        <p className="text-sm text-blue-700 font-medium">
                            Supported formats: <span className="font-bold">.xlsx, .xls, .csv</span>. Use the first row for headers.
                        </p>
                    </div>

                    {/* Standard Fields Table */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Standard Columns</h4>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Column Name</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Required</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Examples</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {standardFields.map((field) => (
                                        <tr key={field.key} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{field.name}</td>
                                            <td className="px-4 py-3">
                                                {field.required ? (
                                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black uppercase rounded">Must Have</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[9px] font-black uppercase rounded">Optional</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] text-gray-500 text-right font-medium">{field.examples}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Dynamic Fields Section */}
                    {dynamicVars.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <List className="w-4 h-4 text-indigo-500" />
                                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Additional Columns (Custom)</h4>
                            </div>
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 grid grid-cols-2 gap-3">
                                {dynamicVars.map(v => (
                                    <div key={v.id} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-900 leading-tight">{v.name}</span>
                                            <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Optional</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium italic ml-1">
                                * Headers must match the exact labels shown above (not case-sensitive).
                            </p>
                        </section>
                    )}

                    {/* Pro Tips */}
                    <section className="p-6 bg-amber-50 rounded-3xl border border-amber-200/50 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <AlertCircle className="w-12 h-12 text-amber-500" />
                        </div>
                        <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            Pro Tips
                        </h4>
                        <ul className="space-y-2 text-xs text-amber-900 font-medium leading-relaxed">
                            <li className="flex gap-2">
                                <span className="text-amber-500">•</span>
                                <span>Ensure there are no empty rows in the middle of your data.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-amber-500">•</span>
                                <span>Phone numbers should be entered as text to preserve leading zeros.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="text-amber-500">•</span>
                                <span>You can leave non-required columns empty, but do not delete the headers.</span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-center gap-4">
                    <button
                        onClick={downloadSample}
                        className="px-6 py-3 bg-white text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-50 transition-all shadow-sm border border-indigo-100 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download Sample
                    </button>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                    >
                        Got it, Let's Import
                    </button>
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
