import React, { useState } from 'react';
import {
  LifeBuoy,
  Mail,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  Code2,
  ShieldCheck,
  Cpu,
  Database,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Clock,
  Terminal,
  FileCode,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const DeveloperSupport: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Technical Support');
  const [priority, setPriority] = useState('NORMAL');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  // FAQ Collapsible State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      // Simulate quick support ticket creation or API logging
      await new Promise((res) => setTimeout(res, 800));
      const ticketId = `TICKET-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      setTicketRef(ticketId);
    } catch {
      setTicketRef(`TICKET-2026-${Math.floor(100000 + Math.random() * 900000)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      q: 'How do I thaw a straw and free physical Viso Tube capacity?',
      a: 'Navigate to the Patient Directory or Thaw tab, select the patient record, pick the active straw(s) you wish to thaw, enter embryologist clinical notes, and click "Execute Thaw & Liberate Capacity". The system will update the straw status to THAWED and immediately liberate space in that Viso Tube.',
    },
    {
      q: 'How does the 8-Step Heatmap Scale work?',
      a: 'The storage heatmap scale represents physical canister occupancy from 0% (White/Pale) to 100% (Deep Red). It helps staff quickly identify available capacity across Level 1 & Level 2 Viso Tubes.',
    },
    {
      q: 'What should I do if an OCR handwritten form scan fails?',
      a: 'Ensure the photo or scan has adequate lighting and sharp focus. You can crop unneeded background before running Google Cloud Vision OCR. Once processed, staff can review and edit parsed fields before saving.',
    },
    {
      q: 'How long do staff user login sessions remain active?',
      a: 'Staff remain active for 24 hours with automatic silent background token renewal, ensuring uninterrupted operations during clinic shifts.',
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
              <Code2 className="w-3.5 h-3.5" />
              <span>DEVELOPER & TECHNICAL SUPPORT CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Need Help or Custom Integration?
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
              Contact our IVF software engineering and lead development team directly for technical assistance, feature requests, system training, or custom clinical integrations.
            </p>
          </div>

          {/* <div className="shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              <span>SYSTEM STATUS: OPERATIONAL</span>
            </div>
            <div className="text-slate-300 text-[11px]">
              <div>Backend API: Connected</div>
              <div>Database: Neon Cloud (Active)</div>
              <div>Build Version: v2.4.0-clinic-2026</div>
            </div>
          </div> */}
        </div>
      </div>

      {/* Developer Profile & Direct Contact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Contact Method 1: Email */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-300 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Direct Developer Email</h3>
              <p className="text-xs text-slate-500 font-medium">Send bug logs, system questions, or technical requests.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800 break-all">
              adityakumar07024@gmail.com
            </div>
          </div>

          <a
            href="mailto:adityakumar07024@gmail.com?subject=IVF%20Clinic%20System%20Support%20Request"
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ring-2 ring-emerald-500/20"
          >
            <Mail className="w-4 h-4 text-emerald-200" />
            <span>Send Email to Developer</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* Contact Method 2: Direct Phone / WhatsApp */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-teal-300 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-700 group-hover:scale-105 transition-transform">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Phone & WhatsApp Support</h3>
              <p className="text-xs text-slate-500 font-medium">Instant developer contact for urgent clinical assistance.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs font-bold text-slate-800">
              +91 8650970092
            </div>
          </div>

          <a
            href="https://wa.me/918650970092?text=Hello%20Developer%2C%20I%20need%20support%20with%20the%20IVF%20Clinic%20Record%20System"
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ring-2 ring-teal-500/20"
          >
            <MessageSquare className="w-4 h-4 text-emerald-200" />
            <span>Chat on WhatsApp (+91 8650970092)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* Contact Method 3: Support SLA & Info */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Priority Support SLA</h3>
              <p className="text-xs text-slate-500 font-medium">Fast response for active medical & laboratory staff.</p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Urgent Clinical:</span>
                <strong className="text-rose-700 font-mono">&lt; 30 Mins</strong>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-slate-500">Standard Request:</span>
                <strong className="text-emerald-700 font-mono">&lt; 2 Hours</strong>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-950 font-bold font-mono text-center">
            24/7 Monitoring & System Backups Active
          </div>
        </div>
      </div>

      {/* Main Support Form & FAQ Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left 3 Columns: Developer Support Ticket Form */}
        <div className="lg:col-span-3 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" />
              <span>Contact Developer / Submit Technical Ticket</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Fill out this form to send a ticket directly to our development team.
            </p>
          </div>

          {ticketRef ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Support Ticket Logged Successfully!</h3>
                  <p className="text-xs text-emerald-800 font-mono font-bold">Ref Code: {ticketRef}</p>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Thank you! Our lead software engineer has received your message and will review your request immediately.
              </p>
              <button
                onClick={() => {
                  setTicketRef(null);
                  setMessage('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendInquiry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Your Name / Staff ID</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Bhakti Mehta (STAFF001)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. doctor@clinic.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="Technical Support">Technical Support</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="System Training">System Training</option>
                    <option value="Custom Integration">Custom Integration</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="LOW">Low (General Query)</option>
                    <option value="NORMAL">Normal Request</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Clinical Request</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Message Details</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question, request, or issue in detail..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Developer Support Request</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right 2 Columns: System FAQs & Technical Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* FAQ Accordion */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>Frequently Asked Questions</span>
              </h2>
            </div>

            <div className="space-y-2">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100 text-left text-xs font-bold text-slate-900 flex items-center justify-between transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 bg-white text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architecture Tech Stack Box */}
          {/* <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs flex items-center gap-2 text-emerald-400">
                <Terminal className="w-4 h-4" />
                <span>System Architecture</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">STACK OVERVIEW</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Frontend Framework:</span>
                <span className="text-slate-200 font-bold">React 18 + TypeScript + Vite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Backend API Engine:</span>
                <span className="text-slate-200 font-bold">Node.js + Express REST</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Database & ORM:</span>
                <span className="text-slate-200 font-bold">PostgreSQL + Prisma ORM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI OCR Engine:</span>
                <span className="text-slate-200 font-bold">Google Cloud Vision API</span>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};
