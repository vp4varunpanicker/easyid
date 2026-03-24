
import React, { useEffect, useState, useRef } from 'react';
import { 
  Shield, 
  Rocket, 
  Users, 
  Palette, 
  UserPlus, 
  GraduationCap, 
  Binary, 
  Printer, 
  Settings, 
  HelpCircle,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  MailCheck,
  MailWarning,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

const Documentation = () => {
  const [activeTab, setActiveTab] = useState('introduction');
  const scrollRef = useRef(null);

  const sections = [
    { id: 'introduction', label: 'Getting Started', icon: Rocket },
    { id: 'user-mgmt', label: 'User & Role Management', icon: Users },
    { id: 'designer', label: 'ID Card Designer', icon: Palette },
    { id: 'students', label: 'Student Onboarding', icon: UserPlus },
    { id: 'classes', label: 'Class & Faculty Mgmt', icon: GraduationCap },
    { id: 'variables', label: 'Dynamic Variables', icon: Binary },
    { id: 'production', label: 'Production Workflow', icon: Printer },
    { id: 'settings', label: 'System Settings', icon: Settings },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id));
      let current = 'introduction';
      sectionElements.forEach(el => {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150) {
            current = el.id;
          }
        }
      });
      setActiveTab(current);
    };

    const container = scrollRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex h-full bg-[#f8fafc] overflow-hidden font-['Plus_Jakarta_Sans',_sans-serif]">
      {/* Sidebar */}
      <aside className="w-[300px] hidden lg:flex flex-col bg-white border-r border-slate-200 p-8 overflow-y-auto">
        <div className="mb-10">
          <h1 className="text-xl font-extrabold text-indigo-600 flex items-center gap-2">
            <Shield className="w-6 h-6" /> IDGen Pro
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Expert Production Suite
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === section.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <section.icon className={`w-4 h-4 ${activeTab === section.id ? 'opacity-100' : 'opacity-60'}`} />
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth p-6 md:p-12 lg:p-16"
      >
        <div className="max-w-4xl mx-auto space-y-12">
          
          {/* Introduction */}
          <section id="introduction" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Rocket className="w-8 h-8 text-indigo-600" /> Getting Started
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Welcome to the <strong>School ID Card Generator</strong>. This system is designed to handle thousands of student records and generate print-ready ID cards in minutes.
            </p>
            
            <h3 className="text-lg font-bold text-slate-800 mb-4">Step 1: Initial Setup</h3>
            <div className="space-y-4">
              {[
                { num: 1, title: 'Environment Configuration', desc: 'Ensure your Firebase project is set up and the credentials are in src/lib/firebase.js.' },
                { num: 2, title: 'Create First Admin', desc: 'Register via the UI. By default, new users have "Pending" status. You must manually set the first user\'s role to super_admin in the Firestore users collection.' },
                { num: 3, title: 'SMTP Setup', desc: 'Navigate to Settings and configure your SMTP server. This is critical for sending welcome emails and password reset links.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* User Management */}
          <section id="user-mgmt" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Users className="w-8 h-8 text-indigo-600" /> User & Role Management
            </h2>
            <p className="text-slate-600 mb-8">Control who can access the system and what they can do.</p>

            <h3 className="text-lg font-bold text-slate-800 mb-4">How to Approve New Staff</h3>
            <div className="space-y-4 mb-8">
              {[
                { num: 1, title: 'Navigate to Roles & Users', desc: 'In the sidebar, select \'Roles & Users\'. You will see a list of registered users.' },
                { num: 2, title: 'Identify Pending Users', desc: 'Users with a yellow PENDING tag are waiting for approval.' },
                { num: 3, title: 'Edit and Assign Role', desc: 'Click the \'Edit\' icon. Select a role (e.g., Teacher or Admin) from the dropdown and click \'Save\'.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Handling Password Resets</h3>
            <div className="space-y-4">
              {[
                { num: 1, title: 'Click \'Key\' Icon', desc: 'Next to the user\'s name, click the key icon.' },
                { num: 2, title: 'Generate Temporary Password', desc: 'The system will generate a secure random password.' },
                { num: 3, title: 'Send Notification', desc: 'Click \'Reset Password\'. The system will update Firebase and email the credentials automatically.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Designer */}
          <section id="designer" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Palette className="w-8 h-8 text-indigo-600" /> ID Card Designer
            </h2>
            <p className="text-slate-600 mb-8">The heart of the system. Create professional templates with drag-and-drop ease.</p>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Creating a Template</h3>
            <div className="space-y-4 mb-8">
              {[
                { num: 1, title: 'Add Elements', desc: 'Use the top bar to add Text, Shapes (Rectangles/Circles), or Images.' },
                { num: 2, title: 'Insert Variables', desc: 'Double-click text to edit. Use {Student Name} or {Class}.' },
                { num: 3, title: 'Smart Positioning', desc: 'Right-click any element to Align or change Stack Order.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-900 p-6 rounded-2xl text-white font-medium text-xs mb-8">
              <div className="flex items-center gap-2"><kbd className="bg-slate-700 px-2 py-1 rounded-lg text-amber-400">Ctrl + Z</kbd> Undo action</div>
              <div className="flex items-center gap-2"><kbd className="bg-slate-700 px-2 py-1 rounded-lg text-amber-400">Ctrl + C/V</kbd> Copy/Paste</div>
              <div className="flex items-center gap-2"><kbd className="bg-slate-700 px-2 py-1 rounded-lg text-amber-400">Arrows</kbd> Nudge 1px</div>
              <div className="flex items-center gap-2"><kbd className="bg-slate-700 px-2 py-1 rounded-lg text-amber-400">Del</kbd> Remove object</div>
            </div>

            <div className="p-6 bg-blue-50 border-l-4 border-blue-500 rounded-2xl text-sm">
              <strong className="text-blue-900 block mb-1">Pro Tip:</strong>
              <p className="text-blue-700">Always click <strong>Lock Design</strong> once finished. This prevents accidental edits and "approves" the template for production.</p>
            </div>
          </section>

          {/* Students */}
          <section id="students" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <UserPlus className="w-8 h-8 text-indigo-600" /> Student Onboarding
            </h2>
            <p className="text-slate-600 mb-8">Getting your data into the system either manually or in bulk.</p>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Method A: Manual Entry</h3>
            <div className="space-y-4 mb-8">
              {[
                { num: 1, title: 'Click \'Add Student\'', desc: 'Fill in Name, Class, Emergency Contact, and Address.' },
                { num: 2, title: 'Upload Photo', desc: 'Select a clear passport-size photo. The system will auto-resize it.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Method B: Excel Bulk Import</h3>
            <div className="space-y-4 mb-8">
              {[
                { num: 1, title: 'Prepare Excel', desc: 'Ensure columns match: FullName, Address, EmergencyNo, BloodGroup.' },
                { num: 2, title: 'Upload File', desc: 'In \'Batch Operations\', select your file for preview.' },
                { num: 3, title: 'Confirm Import', desc: 'Click \'Confirm\' to save all students to the database.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-rose-50 border-l-4 border-rose-500 rounded-2xl text-sm">
              <strong className="text-rose-900 block mb-1">Warning:</strong>
              <p className="text-rose-700">Imported students will not have photos. You must upload them individually via Student Manager or Teacher Dashboard.</p>
            </div>
          </section>

          {/* Classes */}
          <section id="classes" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <GraduationCap className="w-8 h-8 text-indigo-600" /> Class & Faculty Management
            </h2>
            <p className="text-slate-600 mb-8">Organize students into logical groups and assign oversight.</p>

            <h3 className="text-lg font-bold text-slate-800 mb-4">How to Promote a Class</h3>
            <div className="space-y-4 mb-8">
              {[
                { num: 1, title: 'Open Class Details', desc: 'In \'Class Manager\', click the \'Eye\' icon on the class.' },
                { num: 2, title: 'Select Students', desc: 'Check individual students or \'Select All\'.' },
                { num: 3, title: 'Batch Promote', desc: 'Click \'Promote Class\'. Choose the target class (e.g., 10-A).' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Assigning Teachers</h3>
            <div className="space-y-4">
              {[
                { num: 1, title: 'Onboard Staff', desc: 'Go to \'Teacher Manager\' and create a teacher account.' },
                { num: 2, title: 'Link to Class', desc: 'In teacher\'s profile, select their Assigned Class.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Variables */}
          <section id="variables" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Binary className="w-8 h-8 text-indigo-600" /> Dynamic Variables
            </h2>
            <p className="text-slate-600 mb-8">System fields cover basics, but schools often need custom data.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mb-4">Adding a Custom Field (e.g. Bus Route)</h3>
            <div className="space-y-4">
              {[
                { num: 1, title: 'Define Variable', desc: 'Go to \'Variable Manager\'. Add a new field: Bus Route.' },
                { num: 2, title: 'Use in Designer', desc: 'Open the Designer. Add a text element: {Bus Route}.' },
                { num: 3, title: 'Fill Data', desc: 'The \'Add Student\' form will now include a \'Bus Route\' input.' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                  <div>
                    <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                    <p className="text-slate-500 text-sm">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Production */}
          <section id="production" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Printer className="w-8 h-8 text-indigo-600" /> Production Workflow
            </h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Step 1: Check Readiness</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Go to \'Class Manager\'. The completion bar shows readiness. <strong>Do not print if readiness is below 100%.</strong></p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Step 2: Preview</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Click the \'Eye\' icon on a student to see a live preview toggle for Front/Back sides.</p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Step 3: Export PDF</h3>
                <div className="space-y-4 mt-4">
                  {[
                    { num: 1, title: 'Single Export', desc: 'Click \'Download\' on a student card profile.' },
                    { num: 2, title: 'Bulk Generation', desc: 'Use Class Print button for a multi-page PDF formatted for PVC printers.' },
                  ].map((step) => (
                    <div key={step.num} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-l-4 border-indigo-600">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.num}</span>
                      <div>
                        <strong className="block text-slate-900 text-sm mb-1">{step.title}</strong>
                        <p className="text-slate-500 text-sm">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Settings */}
          <section id="settings" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <Settings className="w-8 h-8 text-indigo-600" /> System Settings
            </h2>
            
            <h3 className="text-lg font-bold text-slate-800 mb-4">SMTP Configuration</h3>
            <p className="text-slate-500 text-sm mb-4">Required for automated email notifications:</p>
            <div className="bg-slate-900 p-6 rounded-2xl text-indigo-100 font-mono text-xs leading-relaxed">
              Host: smtp.gmail.com<br />
              Port: 587 (TLS)<br />
              User: school-email@gmail.com<br />
              Pass: [App Password]
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 shadow-sm scroll-mt-8 mb-20">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3 mb-6">
              <HelpCircle className="w-8 h-8 text-indigo-600" /> Troubleshooting
            </h2>
            
            <div className="space-y-4">
              {[
                { title: 'Design looks blurry in PDF', desc: 'Use high-resolution images. Check Export Multiplier in settings.' },
                { title: 'Buttons not clicking', desc: 'Check if design is \'Locked\'. Some actions are disabled in read-only mode.' },
                { title: 'Emails not sending', desc: 'Verify SMTP credentials and Gmail App Passwords.' },
              ].map((issue, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-slate-300">
                  <strong className="block text-slate-900 text-sm mb-1">{issue.title}</strong>
                  <p className="text-slate-500 text-sm">{issue.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="text-center py-10 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100">
            School ID Card Generator v2.4.0 • &copy; 2026 Expert Production Suite
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
